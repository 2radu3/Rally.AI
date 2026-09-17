import os
import sys
import uuid
import shutil
import subprocess
import json

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Paths (all relative to the project root, one level up from backend/) ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "output")
PUBLIC_FOLDER = os.path.join(BASE_DIR, "frontend", "public")
ANALYZER_SCRIPT = os.path.join(BASE_DIR, "analyzer.py")
WEB_INPUT_FILE = os.path.join(BASE_DIR, "web_input.txt")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(PUBLIC_FOLDER, exist_ok=True)


@app.post("/analyze")
async def analyze_video(video: UploadFile = File(...)):
    unique_id = str(uuid.uuid4())
    match_folder = os.path.join(UPLOAD_FOLDER, unique_id)
    os.makedirs(match_folder, exist_ok=True)

    video_path = os.path.join(match_folder, video.filename)
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)

    # Run the real YOLO pose analysis pipeline
    result = subprocess.run(
        [sys.executable, ANALYZER_SCRIPT, video_path, "--output_dir", OUTPUT_FOLDER],
        capture_output=True,
        text=True,
        cwd=BASE_DIR,
    )

    if result.returncode != 0:
        print("=== analyzer.py FAILED ===")
        print(result.stderr)
        print("==========================")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "error": result.stderr[-4000:]},
        )

    analysis_path = os.path.join(OUTPUT_FOLDER, "analysis.json")
    try:
        with open(analysis_path) as f:
            data = json.load(f)
    except FileNotFoundError:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "error": "analyzer.py did not produce analysis.json"},
        )

    players = data.get("players", {})
    summary_raw = data.get("summary", {})
    video_info = data.get("video_info", {})

    forehand_count = backhand_count = smash_count = 0
    per_player = {}

    for pid, pdata in players.items():
        shots = pdata.get("shot_detections", [])
        counts = {"forehand": 0, "backhand": 0, "smash": 0}
        for s in shots:
            shot_type = s.get("type")
            if shot_type in counts:
                counts[shot_type] += 1

        forehand_count += counts["forehand"]
        backhand_count += counts["backhand"]
        smash_count += counts["smash"]

        per_player[f"Player {pid}"] = {
            "total": len(shots),
            "forehand": counts["forehand"],
            "backhand": counts["backhand"],
            "smash": counts["smash"],
        }

    summary = {
        "total_shots": summary_raw.get("total_shots", 0),
        "shots_per_minute": summary_raw.get("shots_per_minute", 0),
        "duration": round(video_info.get("duration", 0)),
        "total_players": summary_raw.get("total_players", 0),
        "forehand_count": forehand_count,
        "backhand_count": backhand_count,
        "smash_count": smash_count,
    }

    # Copy the per-match web heatmap data into frontend/public so heatmap.html
    # (served by Vite at the root) can fetch it by filename.
    heatmap_filename = f"heatmap_{unique_id}.txt"
    if os.path.exists(WEB_INPUT_FILE):
        shutil.copy(WEB_INPUT_FILE, os.path.join(PUBLIC_FOLDER, heatmap_filename))

    return {
        "status": "ok",
        "id": unique_id,
        "summary": summary,
        "per_player": per_player,
        "heatmapFile": heatmap_filename,
    }


@app.get("/videos/{match_id}/{filename}")
async def get_video(match_id: str, filename: str):
    path = os.path.join(UPLOAD_FOLDER, match_id, filename)
    if not os.path.exists(path):
        return JSONResponse(status_code=404, content={"error": "Video not found"})
    return FileResponse(path)

