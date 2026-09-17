from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import subprocess, os, shutil, uuid, json, sys

app = Flask(__name__)
CORS(app)

# Anchor every path to this file's location, not the shell's cwd.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER  = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER  = os.path.join(BASE_DIR, "output")
# Heatmap data is generated at runtime, so Flask serves it -- NOT frontend/public,
# which Vite indexes once at startup and will not re-scan.
HEATMAP_FOLDER = os.path.join(BASE_DIR, "heatmaps")

BACKEND_ORIGIN = os.environ.get("BACKEND_ORIGIN", "http://localhost:8001")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(HEATMAP_FOLDER, exist_ok=True)


@app.route("/analyze", methods=["POST"])
def analyze():
    file = request.files.get("video")
    if not file:
        return jsonify({"error": "No video uploaded"}), 400

    unique_id = str(uuid.uuid4())
    match_folder = os.path.join(UPLOAD_FOLDER, unique_id)
    os.makedirs(match_folder, exist_ok=True)

    video_path = os.path.join(match_folder, file.filename)
    file.save(video_path)

    result = subprocess.run(
        [sys.executable, os.path.join(BASE_DIR, "analyzer.py"),
         video_path, "--output_dir", OUTPUT_FOLDER],
        capture_output=True, text=True,
        cwd=BASE_DIR,          # analyzer.py writes web_input.txt relative to cwd
    )

    if result.returncode != 0:
        return jsonify({"error": result.stderr}), 500

    # analyzer.py writes web_input.txt with a bare relative path, so check both
    # the cwd we forced and the output dir.
    heatmap_filename = f"heatmap_{unique_id}.txt"
    dst_txt = os.path.join(HEATMAP_FOLDER, heatmap_filename)

    src_txt = next(
        (p for p in (os.path.join(BASE_DIR, "web_input.txt"),
                     os.path.join(OUTPUT_FOLDER, "web_input.txt"))
         if os.path.exists(p)),
        None,
    )
    if src_txt is None:
        # Fail loudly. Silently skipping this is what produced a blank heatmap.
        return jsonify({
            "error": "analyzer did not produce web_input.txt",
            "stdout": result.stdout[-2000:],
            "stderr": result.stderr[-2000:],
        }), 500

    shutil.copy(src_txt, dst_txt)

    summary = {}
    per_player = {}
    video_info = {}

    analysis_json_path = os.path.join(OUTPUT_FOLDER, "analysis.json")
    if os.path.exists(analysis_json_path):
        with open(analysis_json_path) as f:
            analysis = json.load(f)

        video_info = analysis.get("video_info", {})
        raw_summary = analysis.get("summary", {})

        # Per-player shot breakdown
        for pid, pdata in analysis.get("players", {}).items():
            shots = pdata.get("shot_detections", [])
            counts = {"forehand": 0, "backhand": 0, "smash": 0}
            for s in shots:
                t = s.get("type", "")
                if t in counts:
                    counts[t] += 1
            per_player[f"P{pid}"] = {
                "total": len(shots),
                "forehand": counts["forehand"],
                "backhand": counts["backhand"],
                "smash": counts["smash"],
            }

        smash_count = sum(p["smash"] for p in per_player.values())
        forehand_count = sum(p["forehand"] for p in per_player.values())
        backhand_count = sum(p["backhand"] for p in per_player.values())

        summary = {
            "total_shots": raw_summary.get("total_shots", 0),
            "smash_count": smash_count,
            "forehand_count": forehand_count,
            "backhand_count": backhand_count,
            "shots_per_minute": raw_summary.get("shots_per_minute", 0),
            "total_players": raw_summary.get("total_players", 0),
            "duration": round(video_info.get("duration", 0)),
            "resolution": video_info.get("resolution", ""),
        }

    # Persist stats alongside video
    with open(os.path.join(match_folder, "stats.json"), "w") as f:
        json.dump({"summary": summary, "per_player": per_player}, f)

    return jsonify({
        "status": "ok",
        "summary": summary,
        "per_player": per_player,
        "heatmapFile": heatmap_filename,
        "heatmapUrl": f"{BACKEND_ORIGIN}/heatmaps/{heatmap_filename}",
        "id": unique_id
    })


@app.route("/heatmaps/<path:filename>", methods=["GET"])
def serve_heatmap(filename):
    if not os.path.exists(os.path.join(HEATMAP_FOLDER, filename)):
        return jsonify({"error": "heatmap not found"}), 404
    # text/plain so the browser doesn't try to sniff it as HTML
    return send_from_directory(HEATMAP_FOLDER, filename, mimetype="text/plain")


@app.route("/videos/<match_id>/<filename>", methods=["GET"])
def serve_video(match_id, filename):
    match_folder = os.path.join(UPLOAD_FOLDER, match_id)
    if not os.path.isdir(match_folder):
        return jsonify({"error": "Match not found"}), 404
    return send_from_directory(match_folder, filename)


@app.route("/matches", methods=["GET"])
def list_matches():
    matches = []
    if not os.path.isdir(UPLOAD_FOLDER):
        return jsonify([])
    for match_id in os.listdir(UPLOAD_FOLDER):
        match_folder = os.path.join(UPLOAD_FOLDER, match_id)
        if not os.path.isdir(match_folder):
            continue
        videos = [f for f in os.listdir(match_folder)
                  if f.lower().endswith(('.mp4', '.mov', '.avi', '.mkv'))]
        if not videos:
            continue
        video_name = videos[0]
        stats_path = os.path.join(match_folder, "stats.json")
        stats = {}
        if os.path.exists(stats_path):
            with open(stats_path) as f:
                stats = json.load(f)
        matches.append({
            "id": match_id,
            "videoName": video_name,
            "videoUrl": f"{BACKEND_ORIGIN}/videos/{match_id}/{video_name}",
            "heatmapFile": f"heatmap_{match_id}.txt",
            "heatmapUrl": f"{BACKEND_ORIGIN}/heatmaps/heatmap_{match_id}.txt",
            "summary": stats.get("summary", {}),
            "per_player": stats.get("per_player", {}),
        })
    return jsonify(matches)


if __name__ == "__main__":
    app.run(debug=True, port=8001)

