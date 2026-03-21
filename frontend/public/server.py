source venv/bin/activatefrom fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import subprocess
import shutil
import os
import json
import uuid
import traceback

app = FastAPI(title="PadelAI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Căi absolute bazate pe locația lui server.py ────────────────────────────
# server.py se află în: frontend/public/
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))   # frontend/public/
ANALYZER_PATH = os.path.join(BASE_DIR, "analyzer.py")        # frontend/public/analyzer.py

# Python din venv-ul backend-ului
PYTHON_BIN = "/home/daniel/hakaton/Rally.AI/backend/venv/bin/python"
if not os.path.exists(PYTHON_BIN):
    # Fallback la python-ul curent
    PYTHON_BIN = sys.executable

# Foldere temporare pentru upload-uri și output-uri
UPLOAD_DIR = "/tmp/padel_uploads"
OUTPUT_DIR = "/tmp/padel_output"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

print(f"✅ BASE_DIR      : {BASE_DIR}")
print(f"✅ ANALYZER_PATH : {ANALYZER_PATH}")
print(f"✅ PYTHON_BIN    : {PYTHON_BIN}")
print(f"✅ analyzer exists: {os.path.exists(ANALYZER_PATH)}")
print(f"✅ python exists  : {os.path.exists(PYTHON_BIN)}")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "analyzer_found": os.path.exists(ANALYZER_PATH),
        "python_bin": PYTHON_BIN,
        "python_exists": os.path.exists(PYTHON_BIN),
    }


@app.post("/analyze")
async def analyze(video: UploadFile = File(...)):
    # ── 1. Generam un job ID unic ────────────────────────────────────────
    job_id     = str(uuid.uuid4())[:8]
    video_path = os.path.join(UPLOAD_DIR, f"{job_id}_{video.filename}")
    output_dir = os.path.join(OUTPUT_DIR, job_id)
    os.makedirs(output_dir, exist_ok=True)

    # ── 2. Salvam videoclipul ────────────────────────────────────────────
    try:
        with open(video_path, "wb") as f:
            shutil.copyfileobj(video.file, f)
        print(f"📹 Video salvat: {video_path} ({os.path.getsize(video_path) / 1024 / 1024:.1f} MB)")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eroare la salvarea videoclipului: {e}")

    # ── 3. Rulam analyzer.py ─────────────────────────────────────────────
    print(f"🚀 Pornesc analyzer pentru job {job_id}...")
    try:
        result = subprocess.run(
            [
                PYTHON_BIN,
                ANALYZER_PATH,
                video_path,
                "--output_dir", output_dir,
                "--max_players", "4",
            ],
            capture_output=True,
            text=True,
            timeout=600,   # 10 minute max
            cwd=BASE_DIR,  # rulam din frontend/public/ ca sa gaseasca yolov8n-pose.pt
        )

        print(f"📊 STDOUT:\n{result.stdout}")
        if result.stderr:
            print(f"⚠️  STDERR:\n{result.stderr}")

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Analyzer error:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
            )

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Analiza a durat prea mult (timeout 10 min).")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Subprocess error: {e}\n{traceback.format_exc()}")

    # ── 4. Cautam web_input.txt ──────────────────────────────────────────
    # analyzer.py scrie web_input.txt in directorul curent (BASE_DIR = public/)
    possible_paths = [
        os.path.join(BASE_DIR, "web_input.txt"),          # frontend/public/web_input.txt  ← cel mai probabil
        os.path.join(output_dir, "web_input.txt"),        # /tmp/padel_output/job_id/web_input.txt
        "web_input.txt",                                   # directorul curent de lucru
    ]

    raw_content = None
    found_path  = None
    for path in possible_paths:
        if os.path.exists(path):
            with open(path, "r") as f:
                raw_content = f.read()
            found_path = path
            print(f"✅ web_input.txt găsit la: {path}")
            break

    if raw_content is None:
        raise HTTPException(
            status_code=500,
            detail=(
                f"web_input.txt nu a fost generat.\n"
                f"Am căutat în: {possible_paths}\n"
                f"STDOUT analyzer: {result.stdout[-500:]}"
            )
        )

    # ── 5. Parsam JSON-ul din "const rawMatchData = [...];" ──────────────
    try:
        json_str = raw_content.strip()
        if json_str.startswith("const rawMatchData ="):
            json_str = json_str[len("const rawMatchData ="):].strip()
        if json_str.endswith(";"):
            json_str = json_str[:-1]
        points = json.loads(json_str)
        print(f"✅ Parsate {len(points)} puncte din web_input.txt")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eroare parsare web_input.txt: {e}\nConținut: {raw_content[:200]}")

    # ── 6. Citim summary din analysis.json (dacă există) ─────────────────
    summary     = {}
    shot_counts = {}

    analysis_json_path = os.path.join(output_dir, "analysis.json")
    if os.path.exists(analysis_json_path):
        try:
            with open(analysis_json_path, "r") as f:
                analysis_data = json.load(f)

            summary      = analysis_data.get("summary", {})
            players_data = analysis_data.get("players", {})

            for pid, pdata in players_data.items():
                for shot in pdata.get("shot_detections", []):
                    stype = shot.get("type", "unknown")
                    shot_counts[stype] = shot_counts.get(stype, 0) + 1

            summary["shot_counts"] = shot_counts
            print(f"✅ Summary: {summary}")
        except Exception as e:
            print(f"⚠️  Nu am putut citi analysis.json: {e}")

    # ── 7. Curatam videoclipul temporar ──────────────────────────────────
    try:
        os.remove(video_path)
    except Exception:
        pass

    return JSONResponse({
        "status":       "success",
        "job_id":       job_id,
        "points":       points,
        "summary":      summary,
        "total_points": len(points),
    })