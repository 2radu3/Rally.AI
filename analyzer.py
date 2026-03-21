import cv2
import numpy as np
import matplotlib.pyplot as plt
from collections import defaultdict, Counter
import argparse
import os
import json
from ultralytics import YOLO

# --- Configuration ---
SHOT_COOLDOWN   = 1.5    # seconds between any shots globally (matches file 2 effective rate)
MIN_VELOCITY    = 0.015  # minimum wrist velocity (fraction of frame width) to consider
CONF_THRESH     = 0.45
MAX_LOST_FRAMES = 90

# --- Load YOLOv8 Pose Model ---
print("Loading YOLOv8n-pose model...")
try:
    model = YOLO("yolov8n-pose.pt")
    print("✅ Model loaded successfully.")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    exit(1)


# ─────────────────────────────────────────────
# PLAYER TRACKER  (from file 1)
# ─────────────────────────────────────────────
class PlayerTracker:
    """
    Fixed ID pool [0..max_players-1]. Centroid-distance matching.
    IDs never exceed max_players regardless of occlusions.
    """
    def __init__(self, max_players=4, max_lost=MAX_LOST_FRAMES, max_dist=200):
        self.max_players = max_players
        self.max_lost    = max_lost
        self.max_dist    = max_dist
        self.free_ids    = list(range(max_players))
        self.tracks      = {}

    @staticmethod
    def _center(bbox):
        return np.array([(bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2], dtype=float)

    def update(self, detections):
        for pid in list(self.tracks.keys()):
            self.tracks[pid]['lost'] += 1
            if self.tracks[pid]['lost'] > self.max_lost:
                self.free_ids.append(pid)
                del self.tracks[pid]

        if not detections:
            return []

        track_ids    = list(self.tracks.keys())
        assigned     = []
        matched_dets = set()

        if track_ids:
            t_centers = np.array([self.tracks[p]['center'] for p in track_ids])
            d_centers = np.array([self._center(d['bbox']) for d in detections])
            dist_mat  = np.linalg.norm(t_centers[:,None,:] - d_centers[None,:,:], axis=2)

            for _ in range(min(len(track_ids), len(detections))):
                ti, di = np.unravel_index(dist_mat.argmin(), dist_mat.shape)
                if dist_mat[ti, di] > self.max_dist:
                    break
                pid = track_ids[ti]
                det = detections[di]
                self.tracks[pid].update({
                    'center': self._center(det['bbox']),
                    'bbox':   det['bbox'],
                    'lost':   0,
                    'kp':     det['keypoints_xy'],
                    'cf':     det['confidences'],
                })
                assigned.append((pid, det))
                matched_dets.add(di)
                dist_mat[ti, :] = np.inf
                dist_mat[:, di] = np.inf

        for di, det in enumerate(detections):
            if di in matched_dets or not self.free_ids:
                continue
            pid = self.free_ids.pop(0)
            self.tracks[pid] = {
                'center': self._center(det['bbox']),
                'bbox':   det['bbox'],
                'lost':   0,
                'kp':     det['keypoints_xy'],
                'cf':     det['confidences'],
            }
            assigned.append((pid, det))

        return assigned


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def get_frame_dims(cap):
    return int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

def get_player_position(kp, cf, frame_w, frame_h):
    if len(kp) < 13: return None
    l_hip, r_hip = kp[11], kp[12]
    if cf[11] < CONF_THRESH or cf[12] < CONF_THRESH: return None
    return {
        'x': float((l_hip[0]+r_hip[0]) / 2 / frame_w),
        'y': float((l_hip[1]+r_hip[1]) / 2 / frame_h),
    }


# ─────────────────────────────────────────────
# SHOT CLASSIFIER  (exact logic from file 2)
# ─────────────────────────────────────────────
def classify_shot(kp, cf, prev_kp, frame_w, frame_h):
    """
    Identical to file 2's classify_shot.
    Only change: divides by frame_w instead of hardcoded 1920.
    """
    if prev_kp is None: return None, 0.0

    lw,  rw  = kp[9],  kp[10]
    plw, prw = prev_kp[9], prev_kp[10]
    ls,  rs  = kp[5],  kp[6]

    max_vel = max(np.linalg.norm(lw - plw), np.linalg.norm(rw - prw)) / frame_w

    if max_vel < MIN_VELOCITY:
        return None, 0.0

    # Smash: wrist above shoulder + fast
    if (lw[1] < ls[1] or rw[1] < rs[1]) and max_vel > 0.02:
        return 'smash', 0.8

    # Drive: wrist position relative to hip centre
    hip_x = (kp[11][0] + kp[12][0]) / 2
    if lw[0] > hip_x or rw[0] > hip_x:
        return 'forehand', 0.7
    return 'backhand', 0.7


# ─────────────────────────────────────────────
# HEATMAP  (from file 1, all players combined)
# ─────────────────────────────────────────────
def generate_heatmap(movement_positions, shot_detections, output_path, heatmap_size=(50, 100)):
    all_positions = [p for positions in movement_positions.values() for p in positions]
    all_shots     = [s for shots in shot_detections.values() for s in shots]

    if not all_positions:
        print("⚠️  No positions to plot.")
        return

    x = [p['x'] for p in all_positions]
    y = [p['y'] for p in all_positions]

    plt.style.use('dark_background')
    plt.figure(figsize=(8, 10))

    # Hexbin heatmap — exact style from file 2
    plt.hexbin(x, y, gridsize=25, cmap='YlOrRd', mincnt=1, edgecolors='none', alpha=0.8)

    # Court markings
    plt.axhline(0.5, color='white', linewidth=2, alpha=0.6)           # net
    plt.axvline(0.5, ymin=0.1, ymax=0.9, color='white',
                linestyle='--', alpha=0.4)                             # centre line

    # Shot summary overlay
    total_shots = len(all_shots)
    stats = Counter(s['type'] for s in all_shots)
    n_players = len(movement_positions)
    summary_txt = f"TOTAL SHOTS: {total_shots}\n"
    summary_txt += "\n".join(f"{k.upper()}: {v}" for k, v in stats.most_common())
    plt.text(0.05, 0.95, summary_txt,
             transform=plt.gca().transAxes, fontsize=10,
             verticalalignment='top',
             bbox=dict(boxstyle='round', facecolor='black', alpha=0.7))

    plt.xlim(0, 1)
    plt.ylim(0, 1)
    plt.gca().invert_yaxis()
    plt.title("Match Intensity Heatmap", pad=20)
    plt.savefig(output_path, dpi=200)
    plt.close()
    plt.style.use('default')   # reset so other plots aren't affected
    print(f"✅ Heatmap saved: {output_path}")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Padel analyser — multi-player tracker + simple shot logic')
    parser.add_argument('video_path',     type=str)
    parser.add_argument('--output_dir',   type=str, default='./output')
    parser.add_argument('--heatmap_size', type=int, nargs=2, default=[50, 100])
    parser.add_argument('--max_players',  type=int, default=4)
    args = parser.parse_args()

    if not os.path.exists(args.video_path):
        print(f"❌ Video not found: {args.video_path}")
        return

    os.makedirs(args.output_dir, exist_ok=True)

    cap = cv2.VideoCapture(args.video_path)
    if not cap.isOpened():
        print(f"❌ Cannot open video: {args.video_path}")
        return

    frame_w, frame_h = get_frame_dims(cap)
    fps          = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration     = total_frames / fps

    print(f"▶️  Video      : {args.video_path}")
    print(f"   Resolution : {frame_w}×{frame_h}  |  {duration:.1f}s  |  {fps:.1f} FPS")

    # Scale tracker max_dist with resolution
    diag      = float(np.sqrt(frame_w**2 + frame_h**2))
    max_dist  = int(diag * 0.20)
    tracker   = PlayerTracker(max_players=args.max_players, max_dist=max_dist)

    shot_detections    = defaultdict(list)   # pid → [shot dicts]
    movement_positions = defaultdict(list)   # pid → [pos dicts]
    prev_kp            = {}                  # pid → last keypoints
    last_shot_time     = -SHOT_COOLDOWN      # single global cooldown (matches file 2)

    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_time = frame_count / fps

        try:
            results = model(frame, verbose=False, imgsz=640)
        except Exception as e:
            print(f"⚠️  Inference error frame {frame_count}: {e}")
            frame_count += 1
            continue

        r = results[0]
        if r.keypoints is None or len(r.keypoints.xy) == 0:
            frame_count += 1
            continue

        detections = []
        boxes = r.boxes.xyxy.cpu().numpy() if r.boxes is not None else []
        for i in range(len(r.keypoints.xy)):
            kp_xy = r.keypoints.xy[i].cpu().numpy()
            cf    = r.keypoints.conf[i].cpu().numpy()
            bbox  = boxes[i].tolist() if i < len(boxes) else [0, 0, frame_w, frame_h]
            detections.append({'bbox': bbox, 'keypoints_xy': kp_xy, 'confidences': cf})

        assigned = tracker.update(detections)

        for pid, det in assigned:
            kp = det['keypoints_xy']
            cf = det['confidences']

            pos = get_player_position(kp, cf, frame_w, frame_h)
            if pos:
                movement_positions[pid].append(pos)

            # Shot classification — single global cooldown (matches file 2 behaviour)
            if pid in prev_kp and (frame_time - last_shot_time) > SHOT_COOLDOWN:
                shot_type, conf = classify_shot(kp, cf, prev_kp[pid], frame_w, frame_h)
                if shot_type:
                    shot_detections[pid].append({
                        'timestamp':      round(frame_time, 3),
                        'type':           shot_type,
                        'confidence':     round(conf, 3),
                        'playerPosition': pos,
                    })
                    last_shot_time = frame_time

            prev_kp[pid] = kp

        frame_count += 1
        if frame_count % max(1, total_frames // 10) == 0:
            total_hits = sum(len(v) for v in shot_detections.values())
            print(f"   ⏳ {frame_count}/{total_frames} ({frame_count/total_frames*100:.1f}%) | Shots: {total_hits}")

    cap.release()

    # ── Summary ──────────────────────────────────────────────────────────
    total_shots = sum(len(v) for v in shot_detections.values())
    print(f"\n📊 Tracked players : {len(movement_positions)}")
    print(f"   Total shots     : {total_shots}")
    for pid in sorted(shot_detections.keys()):
        cnt = Counter(s['type'] for s in shot_detections[pid])
        print(f"\n   Player {pid}:")
        for k, v in cnt.most_common():
            print(f"     {k.upper():20s}: {v}")

    # ── Heatmap ───────────────────────────────────────────────────────────
    heatmap_path = os.path.join(args.output_dir, 'match_heatmap.png')
    generate_heatmap(movement_positions, shot_detections, heatmap_path, args.heatmap_size)

    # ── Shot timeline ─────────────────────────────────────────────────────
    all_shots = sorted(
        [{**s, 'player_id': pid} for pid, shots in shot_detections.items() for s in shots],
        key=lambda x: x['timestamp']
    )
    if all_shots:
        try:
            unique_types = sorted({s['type'] for s in all_shots})
            type_idx     = {t: i for i, t in enumerate(unique_types)}
            colors       = plt.cm.tab10(np.linspace(0, 1, args.max_players))

            plt.figure(figsize=(14, 5))
            for pid, shots in shot_detections.items():
                plt.scatter(
                    [s['timestamp'] for s in shots],
                    [type_idx[s['type']] for s in shots],
                    label=f'Player {pid}',
                    color=colors[pid % len(colors)],
                    s=40, alpha=0.8
                )
            plt.yticks(range(len(unique_types)),
                       [t.replace('_', ' ').title() for t in unique_types])
            plt.xlabel('Time (s)')
            plt.title('Shot Types Over Time – All Players')
            plt.legend(loc='upper right')
            plt.grid(axis='y', linestyle='--', alpha=0.4)
            plt.tight_layout()
            timeline_path = os.path.join(args.output_dir, 'shots_over_time.png')
            plt.savefig(timeline_path, dpi=100)
            plt.close()
            print(f"✅ Shot timeline saved: {timeline_path}")
        except Exception as e:
            print(f"⚠️  Timeline error: {e}")

    # ── JSON ──────────────────────────────────────────────────────────────
    output_data = {
        'video_info': {
            'path':       args.video_path,
            'resolution': f'{frame_w}x{frame_h}',
            'duration':   round(duration, 2),
            'fps':        round(fps, 2),
        },
        'players': {
            str(pid): {
                'shot_detections':   shot_detections[pid],
                'movement_positions': movement_positions[pid],
            }
            for pid in sorted(set(shot_detections.keys()) | set(movement_positions.keys()))
        },
        'summary': {
            'total_players': len(movement_positions),
            'total_shots':   total_shots,
            'shots_per_minute': round(total_shots / (duration / 60), 2) if duration > 0 else 0,
        }
    }
    try:
        json_path = os.path.join(args.output_dir, 'analysis.json')
        with open(json_path, 'w') as f:
            json.dump(output_data, f, indent=2)
        print(f"✅ JSON saved: {json_path}")
    except Exception as e:
        print(f"⚠️  JSON error: {e}")

    print(f"\n📁 Outputs in: {args.output_dir}")
    print("   • match_heatmap.png")
    print("   • shots_over_time.png")
    print("   • analysis.json")


if __name__ == "__main__":
    main()