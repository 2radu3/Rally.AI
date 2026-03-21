import cv2
import os
import json
import time
import shutil
import math
import uuid
import asyncio
import numpy as np
from collections import defaultdict, deque
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from ultralytics import YOLO

app = FastAPI(
    title="Rally.AI Ultra Backend",
    description="AI Padel Coach — Shot Detection, Heatmaps, Error Patterns, Progress Tracking",
    version="4.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── MODELS ─────────────────────────────────────────────────────────────────
model = YOLO('yolov8n.pt')          # person detection
pose_model = YOLO('yolov8n-pose.pt')  # pose estimation for shot detection

HISTORY_FILE  = "session_history.json"
SESSIONS_FILE = "sessions.json"

# ─── COURT ZONES (normalized 0-1) ───────────────────────────────────────────
ZONES = {
    "net":        lambda x, y: y < 0.33,
    "midcourt":   lambda x, y: 0.33 <= y < 0.66,
    "baseline":   lambda x, y: y >= 0.66,
    "left_side":  lambda x, y: x < 0.4,
    "center":     lambda x, y: 0.4 <= x < 0.6,
    "right_side": lambda x, y: x >= 0.6,
}

# ─── HELPERS ────────────────────────────────────────────────────────────────

def load_json(path: str, default):
    if os.path.exists(path):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception:
            pass
    return default


def save_json(path: str, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# ─── HEATMAP GRID (10×10) ───────────────────────────────────────────────────

def build_heatmap_grid(points: list[dict]) -> list[list[int]]:
    """Return a 10×10 frequency grid (row=y bucket, col=x bucket)."""
    grid = [[0] * 10 for _ in range(10)]
    for p in points:
        col = min(int(p["x"] * 10), 9)
        row = min(int(p["y"] * 10), 9)
        grid[row][col] += 1
    return grid


# ─── ZONE STATS ─────────────────────────────────────────────────────────────

def compute_zone_stats(points: list[dict]) -> dict:
    counts = defaultdict(int)
    for p in points:
        for zone, fn in ZONES.items():
            if fn(p["x"], p["y"]):
                counts[zone] += 1
    total = max(1, len(points))
    return {z: round(counts[z] / total * 100, 1) for z in ZONES}


# ─── MOVEMENT METRICS ───────────────────────────────────────────────────────

def compute_movement_metrics(points: list[dict]) -> dict:
    if not points:
        return {}

    distances = []
    for i in range(1, len(points)):
        dx = points[i]["x"] - points[i-1]["x"]
        dy = points[i]["y"] - points[i-1]["y"]
        distances.append(math.sqrt(dx**2 + dy**2))

    total_dist_norm = sum(distances)
    meters = round(total_dist_norm * 25, 1)   # rough court scale

    # Speed variance → consistency score (lower variance = more consistent)
    avg_speed = np.mean(distances) if distances else 0
    speed_std = float(np.std(distances)) if distances else 0
    consistency = max(0, round(100 - speed_std * 500, 1))

    # Lateral coverage: unique x-buckets visited
    x_buckets = {min(int(p["x"] * 10), 9) for p in points}
    lateral_cov = round(len(x_buckets) / 10 * 100, 1)

    return {
        "distance_meters": meters,
        "avg_speed_norm": round(float(avg_speed), 4),
        "consistency_pct": consistency,
        "lateral_coverage_pct": lateral_cov,
        "work_rate": "High" if meters > 20 else "Moderate" if meters > 8 else "Low",
        "intensity": "Pro Level" if meters > 25 else "Training" if meters > 10 else "Warm-up",
    }


# ─── SHOT DETECTION VIA POSE DELTA ─────────────────────────────────────────
# Problema cu detectarea frame-by-frame: orice poziție statică a încheieturii
# înalte = "smash", ceea ce e greșit. Un smash/voleu real = MIȘCARE rapidă
# a încheieturii, nu o poziție statică.
#
# Soluție: comparăm keypoints între frame-ul curent și cel anterior (delta).
# Un shot adevărat = viteză mare a wrist-ului relativ la umăr, într-o singură
# direcție clară. Detectăm evenimentul, nu starea.

class ShotDetector:
    """
    Stateful shot detector bazat pe viteza și traiectoria încheieturii.
    Compară keypoints între frame-uri consecutive pentru a detecta momentul
    real al impactului, nu poziția statică.
    """

    # Minimum frames între două lovituri detectate (evităm dubla numărare)
    COOLDOWN_FRAMES = 15  # ~0.5s la 30fps

    def __init__(self):
        # Istoric keypoints: {person_id: deque of (wrist_x, wrist_y, shoulder_y)}
        self.prev_keypoints: dict[int, tuple] = {}
        self.frames_since_shot: dict[int, int] = defaultdict(lambda: 999)
        self.shot_log: list[dict] = []  # toate loviturile detectate cu timestamp

    def update(self, frame, video_ts: float) -> dict:
        """
        Procesează un frame și returnează loviturile detectate în el.
        Returnează {"smash": n, "volley": n, "groundstroke": n, "events": [...]}
        """
        results = pose_model.predict(frame, conf=0.45, verbose=False)
        frame_shots = {"smash": 0, "volley": 0, "groundstroke": 0, "events": []}

        if not results or results[0].keypoints is None:
            return frame_shots

        h, w = frame.shape[:2]

        for person_id, kp in enumerate(results[0].keypoints.xy):
            if len(kp) < 17:
                continue

            # Convertim la float Python imediat — kp[i] e Tensor PyTorch
            # si orice round/comparatie pe Tensor arunca eroare
            def p(idx):
                return float(kp[idx][0]), float(kp[idx][1])

            l_sh_x,  l_sh_y  = p(5)
            r_sh_x,  r_sh_y  = p(6)
            l_wr_x,  l_wr_y  = p(9)
            r_wr_x,  r_wr_y  = p(10)
            l_hip_x, l_hip_y = p(11)
            r_hip_x, r_hip_y = p(12)

            # Ignora keypoints nedetectate (0,0)
            if (l_sh_x == 0 and l_sh_y == 0) or (r_sh_x == 0 and r_sh_y == 0):
                continue

            # Mana activa = wrist-ul mai sus (y mai mic in coord imagine)
            if l_wr_y < r_wr_y:
                active_wx, active_wy = l_wr_x, l_wr_y
                same_sh_y = l_sh_y
            else:
                active_wx, active_wy = r_wr_x, r_wr_y
                same_sh_y = r_sh_y

            # Inaltimea corpului pentru normalizare (shoulder -> mid-hip)
            mid_hip_y   = (l_hip_y + r_hip_y) / 2.0
            body_height = abs(same_sh_y - mid_hip_y)
            if body_height < 10:
                body_height = 100.0

            # Pozitie relativa wrist fata de umar (normalizat)
            # >0 = wrist deasupra umarului, <0 = sub umar
            wrist_above_sh = (same_sh_y - active_wy) / body_height

            # Delta fata de frame anterior
            prev = self.prev_keypoints.get(person_id)
            self.prev_keypoints[person_id] = (active_wx, active_wy, same_sh_y, wrist_above_sh)
            self.frames_since_shot[person_id] += 1

            if prev is None:
                continue  # primul frame, nu avem delta

            prev_wx, prev_wy, prev_shy, prev_rel = prev
            curr_wx = active_wx
            curr_wy = active_wy


            # Viteza wrist în pixeli/frame (normalizată la lățimea frame-ului)
            delta_x = (curr_wx - prev_wx) / w
            delta_y = (curr_wy - prev_wy) / h
            wrist_speed = math.sqrt(delta_x**2 + delta_y**2)

            # Schimbare rapidă de poziție relativă = lovitură
            rel_delta = abs(wrist_above_sh - prev_rel)

            # Threshold: mișcare semnificativă a wrist-ului
            # Empiric: >0.015 normalizat = mișcare rapidă reală
            is_fast_move   = wrist_speed > 0.015
            is_rel_change  = rel_delta > 0.08
            in_cooldown    = self.frames_since_shot[person_id] < self.COOLDOWN_FRAMES

            if not (is_fast_move or is_rel_change) or in_cooldown:
                continue

            # ── Clasificare tip lovitură ───────────────────────────────────
            # Bazat pe POZIȚIA la momentul impactului (unde e wrist-ul când
            # viteza e maximă), nu pe o pozitie statică.

            shot_type = None

            if wrist_above_sh > 0.3:
                # Wrist mult deasupra umărului + mișcare = SMASH / serve
                shot_type = "smash"

            elif wrist_above_sh > -0.1 and wrist_above_sh <= 0.3:
                # Wrist la nivelul umărului ± = VOLEU
                # Extra: dacă mișcarea e preponderent laterală → voleu
                shot_type = "volley"

            else:
                # Wrist sub umăr = GROUNDSTROKE (forehand / backhand / bandeja)
                shot_type = "groundstroke"

            if shot_type:
                self.frames_since_shot[person_id] = 0
                frame_shots[shot_type] += 1

                event = {
                    "ts":        round(video_ts, 2),
                    "type":      shot_type,
                    "wrist_rel": round(wrist_above_sh, 3),
                    "speed":     round(wrist_speed, 4),
                }
                frame_shots["events"].append(event)
                self.shot_log.append(event)

        return frame_shots

    def get_totals(self) -> dict:
        """Totaluri acumulate pe toată sesiunea."""
        totals = {"smash": 0, "volley": 0, "groundstroke": 0}
        for ev in self.shot_log:
            totals[ev["type"]] += 1
        return totals

    def get_shot_log(self) -> list[dict]:
        return self.shot_log


# Funcție wrapper pentru compatibilitate cu codul existent
def detect_shots_from_pose(frame) -> dict:
    """
    Wrapper simplu — returnează doar counts fără stare.
    Folosit doar în /analyze (sync). Pentru /analyze/live se folosește
    instanța ShotDetector din process_video().
    """
    results = pose_model.predict(frame, conf=0.45, verbose=False)
    shots = {"smash": 0, "volley": 0, "groundstroke": 0}

    if not results or results[0].keypoints is None:
        return shots

    h, w = frame.shape[:2]
    for kp in results[0].keypoints.xy:
        if len(kp) < 11:
            continue
        l_sh = kp[5]; r_sh = kp[6]
        l_wr = kp[9]; r_wr = kp[10]

        # Mâna activă = wrist-ul mai sus
        active_wrist = l_wr if l_wr[1] < r_wr[1] else r_wr
        same_side_sh = l_sh if l_wr[1] < r_wr[1] else r_sh

        if same_side_sh[1] == 0:
            continue

        rel = (same_side_sh[1] - active_wrist[1]) / max(h * 0.3, 1)

        if rel > 0.3:
            shots["smash"] += 1
        elif rel > -0.1:
            shots["volley"] += 1
        else:
            shots["groundstroke"] += 1

    return shots


# ─── LIVE COMMENTARY ENGINE ─────────────────────────────────────────────────
# Tracks state across frames to generate CONTEXTUAL comments — not random ones.
# Every comment is triggered by a real CV event detected in that frame window.

class LiveCommentator:
    """
    Stateful commentator that watches frame-by-frame CV data and fires
    comments only when something meaningful actually happens.
    """

    # How many seconds must pass before we allow a new comment (avoid spam)
    COOLDOWN = {
        "shot":     1.5,
        "position": 4.0,
        "rally":    6.0,
        "warning":  5.0,
        "praise":   5.0,
    }

    def __init__(self, fps: float):
        self.fps = fps
        self.last_comment_time: dict[str, float] = defaultdict(float)  # category → video_ts
        self.prev_positions: deque = deque(maxlen=8)   # last 8 detected (x,y)
        self.prev_shot_type: str | None = None
        self.stationary_streak = 0      # frames player hasn't moved much
        self.net_streak = 0             # consecutive frames near net
        self.rally_len = 0              # consecutive frames with a detected person
        self.last_x: float | None = None
        self.comments: list[dict] = []  # accumulated

    # ── internal helpers ────────────────────────────────────────────────────

    def _now_ok(self, category: str, video_ts: float) -> bool:
        """True if enough time has passed since last comment of this category."""
        return (video_ts - self.last_comment_time[category]) >= self.COOLDOWN[category]

    def _emit(self, category: str, text: str, video_ts: float, sentiment: str = "neutral"):
        self.last_comment_time[category] = video_ts
        entry = {
            "ts":        round(video_ts, 2),  # seconds into the video
            "category":  category,
            "sentiment": sentiment,           # "good" | "bad" | "neutral"
            "text":      text,
        }
        self.comments.append(entry)
        return entry  # caller can SSE-stream this immediately

    # ── main per-frame update ────────────────────────────────────────────────

    def update(
        self,
        video_ts: float,
        detections: list[dict],   # [{x, y}] from person detector
        pose_shots: dict,         # {"smash": n, "volley": n, "groundstroke": n}
    ) -> list[dict]:
        """
        Call once per processed frame. Returns list of NEW comments fired this frame
        (may be empty). Comments are also stored in self.comments.
        """
        new_comments = []

        if not detections:
            self.rally_len = 0
            self.stationary_streak += 1
            # Long absence → player might have missed the ball / fell
            if self.stationary_streak > 45 and self._now_ok("warning", video_ts):
                c = self._emit("warning",
                    "⚠️ Jucătorul a dispărut din cadru — a ratat mingea sau s-a deplasat în afara terenului?",
                    video_ts, "bad")
                new_comments.append(c)
            return new_comments

        self.stationary_streak = 0
        self.rally_len += 1

        # Take the primary player (highest confidence = first box)
        px, py = detections[0]["x"], detections[0]["y"]
        self.prev_positions.append((px, py))

        # ── 1. SHOT DETECTION ──────────────────────────────────────────────
        dominant_shot = max(pose_shots, key=pose_shots.get)
        shot_count    = pose_shots[dominant_shot]

        if shot_count > 0 and dominant_shot != self.prev_shot_type and self._now_ok("shot", video_ts):
            if dominant_shot == "smash":
                if py < 0.4:  # player near net → good positioning for smash
                    c = self._emit("shot",
                        "💥 SMASH! Lovitură overhead executată de la fileu — poziționare excelentă pentru finalizare!",
                        video_ts, "good")
                else:
                    c = self._emit("shot",
                        "💥 Smash de la distanță — risc crescut. Smash-ul e mai eficient de la fileu!",
                        video_ts, "bad")
                new_comments.append(c)

            elif dominant_shot == "volley":
                if py < 0.35:
                    c = self._emit("shot",
                        "🎾 Voleu precis la fileu — control bun al mingii și poziție agresivă!",
                        video_ts, "good")
                else:
                    c = self._emit("shot",
                        "🎾 Voleu executat de la mijlocul terenului — încearcă să urci mai aproape de fileu înainte de voleu.",
                        video_ts, "bad")
                new_comments.append(c)

            elif dominant_shot == "groundstroke":
                if py > 0.65:
                    c = self._emit("shot",
                        "🏓 Groundstroke de la linia de fund — lovitură defensivă solidă.",
                        video_ts, "neutral")
                else:
                    c = self._emit("shot",
                        "🏓 Groundstroke din midcourt — ai putea finaliza cu voleu din această poziție!",
                        video_ts, "neutral")
                new_comments.append(c)

            self.prev_shot_type = dominant_shot

        # ── 2. POSITION AWARENESS ──────────────────────────────────────────
        if self._now_ok("position", video_ts):

            # Near net for a long streak → good or bad depending on context
            if py < 0.33:
                self.net_streak += 1
                if self.net_streak >= 3:
                    c = self._emit("position",
                        f"📍 Jucătorul domină fileul — poziție de atac susținută! Atenție la loburile adversarului.",
                        video_ts, "good")
                    new_comments.append(c)
                    self.net_streak = 0
            else:
                self.net_streak = 0

            # Stuck in a corner
            if px < 0.15 and self._now_ok("warning", video_ts):
                c = self._emit("warning",
                    "⚠️ Jucătorul prins în colțul stâng — toată jumătatea dreaptă a terenului e descoperită!",
                    video_ts, "bad")
                new_comments.append(c)
            elif px > 0.85 and self._now_ok("warning", video_ts):
                c = self._emit("warning",
                    "⚠️ Jucătorul prins în colțul drept — repoziționare urgentă spre centru!",
                    video_ts, "bad")
                new_comments.append(c)

        # ── 3. MOVEMENT QUALITY ────────────────────────────────────────────
        if len(self.prev_positions) >= 4 and self._now_ok("rally", video_ts):
            pts = list(self.prev_positions)
            # Total movement over last 8 frames
            total_move = sum(
                math.sqrt((pts[i][0]-pts[i-1][0])**2 + (pts[i][1]-pts[i-1][1])**2)
                for i in range(1, len(pts))
            )
            # Abrupt direction change: check if player zigzagged
            x_vals = [p[0] for p in pts]
            direction_flips = sum(
                1 for i in range(1, len(x_vals)-1)
                if (x_vals[i]-x_vals[i-1]) * (x_vals[i+1]-x_vals[i]) < -0.001
            )

            if total_move < 0.02:
                c = self._emit("rally",
                    "🐢 Jucătorul stă pe loc — lipsă de footwork reactiv. Menține pașii mici de ajustare!",
                    video_ts, "bad")
                new_comments.append(c)
            elif total_move > 0.3:
                c = self._emit("rally",
                    "🏃 Sprint intens! Jucătorul acoperă teren mult — rezistență fizică ridicată.",
                    video_ts, "good")
                new_comments.append(c)

            if direction_flips >= 3 and total_move > 0.1:
                c = self._emit("praise",
                    "✅ Schimbări de direcție rapide — mișcare laterală foarte bună, adversarul e dezechilibrat!",
                    video_ts, "good")
                new_comments.append(c)

        # ── 4. RALLY MILESTONES ────────────────────────────────────────────
        fps_int = max(1, int(self.fps))
        if self.rally_len == fps_int * 5 and self._now_ok("rally", video_ts):
            c = self._emit("rally",
                "🔥 5 secunde de rally continuu — schimb prelungit, ambii jucători sub presiune!",
                video_ts, "neutral")
            new_comments.append(c)
        elif self.rally_len == fps_int * 15 and self._now_ok("rally", video_ts):
            c = self._emit("rally",
                "🔥🔥 Rally de 15 secunde! Punct spectaculos în desfășurare — rezistență mentală testată!",
                video_ts, "good")
            new_comments.append(c)

        return new_comments


# ─── ERROR PATTERN IDENTIFICATION ───────────────────────────────────────────

def identify_error_patterns(zone_stats: dict, movement: dict, shot_counts: dict) -> list[str]:
    errors = []

    left_pct  = zone_stats.get("left_side", 0)
    right_pct = zone_stats.get("right_side", 0)
    net_pct   = zone_stats.get("net", 0)
    base_pct  = zone_stats.get("baseline", 0)

    if left_pct > 60:
        errors.append({
            "pattern": "Lateral Drift — Left",
            "description": "Petreci >60% din timp pe stânga. Adversarul îți poate exploata culoarul drept.",
            "severity": "high"
        })
    if right_pct > 60:
        errors.append({
            "pattern": "Lateral Drift — Right",
            "description": "Supraexpunere pe dreapta. Revino în centru după fiecare lovitură.",
            "severity": "high"
        })
    if base_pct > 75:
        errors.append({
            "pattern": "Passive Baseline Play",
            "description": "Ești prea pasiv. Un jucător de padel eficient urcă la fileu să finalizeze.",
            "severity": "medium"
        })
    if net_pct > 55:
        errors.append({
            "pattern": "Net Rush Overuse",
            "description": "Prea mult timp la fileu fără support pozițional. Risc de lob ușor al adversarului.",
            "severity": "medium"
        })
    if movement.get("lateral_coverage_pct", 100) < 40:
        errors.append({
            "pattern": "Narrow Court Coverage",
            "description": "Acoperi mai puțin de 40% din lățimea terenului. Footwork lateral trebuie îmbunătățit.",
            "severity": "high"
        })
    if movement.get("consistency_pct", 100) < 40:
        errors.append({
            "pattern": "Erratic Movement",
            "description": "Viteza de deplasare este inconsistentă — sprinturi urmate de pauze lungi.",
            "severity": "medium"
        })

    total_shots = max(1, sum(shot_counts.values()))
    smash_ratio = shot_counts.get("smash", 0) / total_shots
    if smash_ratio > 0.5:
        errors.append({
            "pattern": "Smash Over-reliance",
            "description": "Jumătate din lovituri sunt overhead. Variați cu volei tăiat pentru mai mult control.",
            "severity": "low"
        })

    return errors


# ─── DRILL SUGGESTIONS ──────────────────────────────────────────────────────

def suggest_drills(errors: list[dict], movement: dict) -> list[dict]:
    drills = []
    patterns = {e["pattern"] for e in errors}

    if "Lateral Drift — Left" in patterns or "Lateral Drift — Right" in patterns:
        drills.append({
            "name": "Center Reset Drill",
            "description": "Lovește mingea și revino obligatoriu în centrul terenului înainte de următorul punct.",
            "duration": "15 min",
            "intensity": "Medium"
        })
    if "Passive Baseline Play" in patterns:
        drills.append({
            "name": "Transition Attack Drill",
            "description": "Joacă schimburi cu parteneru, la fiecare a 3-a minge urcă la fileu și finalizează cu voleu.",
            "duration": "20 min",
            "intensity": "High"
        })
    if "Narrow Court Coverage" in patterns or "Erratic Movement" in patterns:
        drills.append({
            "name": "Spider Footwork",
            "description": "Pleacă din centru, atinge câte un con din cele 4 colțuri, revenind la centru între fiecare.",
            "duration": "10 min",
            "intensity": "High"
        })
    if "Net Rush Overuse" in patterns:
        drills.append({
            "name": "Lob Recovery",
            "description": "Partenerul lobează, tu recuperezi și resetezi punctul de la linia de fund.",
            "duration": "15 min",
            "intensity": "Medium"
        })

    # Always add a baseline drill
    drills.append({
        "name": "Consistency Baseline Rally",
        "description": "50 de schimburi consecutive fără greșeală. Focalizare pe respingere controlată.",
        "duration": "10 min",
        "intensity": "Low"
    })

    return drills


# ─── AI COACHING ADVICE ─────────────────────────────────────────────────────

def generate_coaching_advice(zone_stats: dict, movement: dict, shot_counts: dict, errors: list[dict]) -> str:
    lines = []

    wr = movement.get("work_rate", "N/A")
    dist = movement.get("distance_meters", 0)
    cons = movement.get("consistency_pct", 0)

    lines.append(f"📊 Ai parcurs ~{dist}m în această sesiune — nivel de efort: {wr}.")

    if cons > 70:
        lines.append("✅ Mișcare consistentă și controlată — semn de condiție fizică bună.")
    else:
        lines.append("⚠️ Mișcarea ta este neregulată. Lucrează la recuperarea poziției după fiecare lovitură.")

    net_pct = zone_stats.get("net", 0)
    if net_pct > 40:
        lines.append(f"🎾 Ești agresiv la fileu ({net_pct}% din timp). Continuă, dar asigură-te că ai acoperire pentru lob.")
    else:
        lines.append(f"💡 Petreci doar {net_pct}% din timp la fileu. Urcă mai mult pentru a finaliza punctele.")

    if errors:
        top = errors[0]
        lines.append(f"🔴 Pattern critic detectat: {top['pattern']} — {top['description']}")

    total_shots = max(1, sum(shot_counts.values()))
    lines.append(
        f"🏓 Lovituri detectate: {shot_counts.get('groundstroke',0)} groundstrokes, "
        f"{shot_counts.get('volley',0)} voleiuri, {shot_counts.get('smash',0)} smash-uri."
    )

    return " | ".join(lines)


# ─── SESSION HISTORY + IMPROVEMENT GRAPH ────────────────────────────────────

def save_session(session_id: str, metrics_snapshot: dict):
    sessions = load_json(SESSIONS_FILE, [])
    sessions.append({
        "id": session_id,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        **metrics_snapshot
    })
    save_json(SESSIONS_FILE, sessions[-20:])  # keep last 20


def build_improvement_graph(current_metrics: dict) -> list[dict]:
    """Returns list of {timestamp, distance, consistency, net_pct} for charting."""
    sessions = load_json(SESSIONS_FILE, [])
    graph = []
    for s in sessions:
        graph.append({
            "timestamp": s.get("timestamp"),
            "distance_meters": s.get("distance_meters", 0),
            "consistency_pct": s.get("consistency_pct", 0),
            "net_pct": s.get("net_pct", 0),
            "work_rate": s.get("work_rate", "N/A"),
        })
    return graph


# ─── SSE LIVE COMMENTARY ENDPOINT ───────────────────────────────────────────
# Streams comments in real-time as the video is processed.
# Frontend connects with: EventSource('/analyze/live?session_id=xxx')
# and receives JSON events as the analysis progresses.

@app.post("/analyze/live")
async def analyze_video_live(file: UploadFile = File(...)):
    """
    Streams SSE events while processing the video frame-by-frame.
    CV work runs in a thread so it doesn't block the async event loop —
    this is what makes progress/comment messages actually arrive in real time.

    Event types the frontend receives:
      init     → {session_id, total_frames, fps, duration_s}
      progress → {pct, ts}          (every ~1 sec of video)
      comment  → {ts, category, sentiment, text}
      done     → {session_id, all_comments, heatmap, zone_stats,
                  movement_metrics, shot_counts, error_patterns,
                  drill_suggestions}
      error    → {message}
    """
    if not file.filename.lower().endswith((".mp4", ".mov", ".avi", ".mkv", ".webm")):
        raise HTTPException(400, "Unsupported file type.")

    session_id = str(uuid.uuid4())[:8]
    temp_path  = f"temp_live_{session_id}_{file.filename}"

    with open(temp_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    # asyncio Queue bridges the CV thread → async generator
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def process_video():
        """Runs in a thread. Puts SSE-ready dicts into the queue."""
        try:
            cap = cv2.VideoCapture(temp_path)
            if not cap.isOpened():
                loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "message": "Could not open video."})
                return

            fps          = cap.get(cv2.CAP_PROP_FPS) or 30
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            commentator  = LiveCommentator(fps)
            shot_detector = ShotDetector()   # stateful, delta-based
            heatmap_points = []

            loop.call_soon_threadsafe(queue.put_nowait, {
                "type":         "init",
                "session_id":   session_id,
                "total_frames": total_frames,
                "fps":          round(fps),
                "duration_s":   round(total_frames / fps, 1),
            })

            frame_idx  = 0
            MAX_FRAMES = int(fps * 60)

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret or frame_idx > MAX_FRAMES:
                    break

                video_ts = frame_idx / fps

                if frame_idx % 5 == 0:
                    # Person detection → heatmap
                    det = model.predict(frame, classes=[0], conf=0.35, verbose=False)
                    positions = []
                    for box in det[0].boxes:
                        xn = round(float(box.xywhn[0][0]), 4)
                        yn = round(float(box.xywhn[0][1]), 4)
                        heatmap_points.append({"x": xn, "y": yn})
                        positions.append({"x": xn, "y": yn})

                    # Shot detection — stateful delta detector
                    frame_shots = shot_detector.update(frame, video_ts)

                    # SSE: stream fiecare lovitură detectată imediat
                    for ev in frame_shots.get("events", []):
                        loop.call_soon_threadsafe(queue.put_nowait, {
                            "type":      "shot_event",
                            "shot_type": ev["type"],
                            "ts":        ev["ts"],
                            "speed":     ev["speed"],
                        })

                    # Live commentary (folosim counts din frame curent)
                    frame_counts = {k: frame_shots[k] for k in ("smash","volley","groundstroke")}
                    new_comments = commentator.update(video_ts, positions, frame_counts)
                    for comment in new_comments:
                        loop.call_soon_threadsafe(queue.put_nowait, {"type": "comment", **comment})

                    # Progress ~1/sec
                    if frame_idx % int(fps) == 0:
                        pct = round(min(frame_idx / MAX_FRAMES, 1.0) * 100)
                        # Trimitem și totalurile curente în progress
                        totals = shot_detector.get_totals()
                        loop.call_soon_threadsafe(queue.put_nowait, {
                            "type":        "progress",
                            "pct":         pct,
                            "ts":          round(video_ts, 1),
                            "shot_totals": totals,
                        })

                frame_idx += 1

            cap.release()

            # Totaluri finale reale
            shot_counts  = shot_detector.get_totals()
            shot_log     = shot_detector.get_shot_log()

            # Build final stats
            zone_stats   = compute_zone_stats(heatmap_points)
            movement     = compute_movement_metrics(heatmap_points)
            heatmap_grid = build_heatmap_grid(heatmap_points)
            errors       = identify_error_patterns(zone_stats, movement, shot_counts)
            drills       = suggest_drills(errors, movement)

            save_session(session_id, {
                "distance_meters": movement.get("distance_meters", 0),
                "consistency_pct": movement.get("consistency_pct", 0),
                "net_pct":         zone_stats.get("net", 0),
                "work_rate":       movement.get("work_rate", "N/A"),
            })

            loop.call_soon_threadsafe(queue.put_nowait, {
                "type":              "done",
                "session_id":        session_id,
                "all_comments":      commentator.comments,
                "shot_log":          shot_log,   # fiecare lovitură cu timestamp
                "heatmap":           {"points": heatmap_points, "grid_10x10": heatmap_grid},
                "zone_stats":        zone_stats,
                "movement_metrics":  movement,
                "shot_counts":       shot_counts,
                "error_patterns":    errors,
                "drill_suggestions": drills,
                "improvement_graph": build_improvement_graph({}),
            })

        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "message": str(e)})
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            # Sentinel: tells the async generator to stop
            loop.call_soon_threadsafe(queue.put_nowait, None)

    async def event_stream():
        # Start CV processing in background thread
        import concurrent.futures
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        loop.run_in_executor(executor, process_video)

        # Drain the queue and yield SSE messages as they arrive
        while True:
            item = await queue.get()
            if item is None:  # sentinel → processing finished
                break
            yield _sse(item)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


def _sse(data: dict) -> str:
    """Format a dict as an SSE message."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


# ─── MAIN ANALYZE ENDPOINT ──────────────────────────────────────────────────

@app.post("/analyze")
async def analyze_video(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".mp4", ".mov", ".avi", ".mkv", ".webm")):
        raise HTTPException(400, "Unsupported file type. Upload a video file.")

    session_id = str(uuid.uuid4())[:8]
    temp_path  = f"temp_{session_id}_{file.filename}"

    try:
        with open(temp_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)

        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            raise HTTPException(400, "Could not open video file.")

        fps         = cap.get(cv2.CAP_PROP_FPS) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_s  = round(total_frames / fps, 1)

        heatmap_points: list[dict] = []
        shot_counts = {"smash": 0, "volley": 0, "groundstroke": 0}
        frame_idx   = 0
        MAX_FRAMES  = int(fps * 60)
        commentator = LiveCommentator(fps)

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame_idx > MAX_FRAMES:
                break

            if frame_idx % 5 == 0:
                video_ts = frame_idx / fps

                # 1. Person detection + heatmap
                det_results = model.predict(frame, classes=[0], conf=0.35, verbose=False)
                positions = []
                for box in det_results[0].boxes:
                    xn = round(float(box.xywhn[0][0]), 4)
                    yn = round(float(box.xywhn[0][1]), 4)
                    heatmap_points.append({"x": xn, "y": yn})
                    positions.append({"x": xn, "y": yn})

                # 2. Pose estimation → shot detection
                shots = detect_shots_from_pose(frame)
                for k, v in shots.items():
                    shot_counts[k] += v

                # 3. Commentator update (stores internally)
                commentator.update(video_ts, positions, shots)

            frame_idx += 1

        cap.release()

        if not heatmap_points:
            return JSONResponse({"status": "no_player_detected",
                                 "message": "Nu am detectat niciun jucător. Verifică calitatea video-ului."})

        # ── Compute all metrics ──────────────────────────────────────────────
        zone_stats  = compute_zone_stats(heatmap_points)
        movement    = compute_movement_metrics(heatmap_points)
        heatmap_grid = build_heatmap_grid(heatmap_points)
        errors      = identify_error_patterns(zone_stats, movement, shot_counts)
        drills      = suggest_drills(errors, movement)
        advice      = generate_coaching_advice(zone_stats, movement, shot_counts, errors)

        # ── Save for improvement graph ───────────────────────────────────────
        metrics_snapshot = {
            "distance_meters":   movement.get("distance_meters", 0),
            "consistency_pct":   movement.get("consistency_pct", 0),
            "net_pct":           zone_stats.get("net", 0),
            "work_rate":         movement.get("work_rate", "N/A"),
        }
        save_session(session_id, metrics_snapshot)
        improvement_graph = build_improvement_graph(metrics_snapshot)

        return {
            "status":      "success",
            "session_id":  session_id,
            "video_info":  {"duration_seconds": duration_s, "total_frames": total_frames, "fps": round(fps)},

            # ── Heatmap data ────────────────────────────────────────────────
            "heatmap": {
                "points":     heatmap_points,   # raw (x,y) list for custom viz
                "grid_10x10": heatmap_grid,     # 10×10 frequency matrix
            },

            # ── Zone breakdown ──────────────────────────────────────────────
            "zone_stats": zone_stats,

            # ── Movement analysis ───────────────────────────────────────────
            "movement_metrics": movement,

            # ── Shot detection ──────────────────────────────────────────────
            "shot_counts": shot_counts,

            # ── Error patterns ──────────────────────────────────────────────
            "error_patterns": errors,

            # ── AI coaching text ────────────────────────────────────────────
            "coach_advice": advice,

            # ── Personalised drills ─────────────────────────────────────────
            "drill_suggestions": drills,

            # ── Session-over-session improvement ────────────────────────────
            "improvement_graph": improvement_graph,

            # ── Timestamped commentary log (same as /analyze/live stream) ───
            # Each entry: {ts, category, sentiment, text}
            # Frontend can replay comments synced to the video scrubber.
            "live_commentary": commentator.comments,
        }

    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ─── HISTORY ENDPOINT ───────────────────────────────────────────────────────

@app.get("/history")
async def get_history():
    return load_json(SESSIONS_FILE, [])


@app.get("/history/{session_id}")
async def get_session(session_id: str):
    sessions = load_json(SESSIONS_FILE, [])
    for s in sessions:
        if s.get("id") == session_id:
            return s
    raise HTTPException(404, "Session not found")


# ─── HEALTH CHECK ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "4.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
