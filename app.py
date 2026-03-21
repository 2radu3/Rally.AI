from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess, os, shutil, uuid, json   # ← json not _json

app = Flask(__name__)
CORS(app)  # allow all origins in dev

UPLOAD_FOLDER = "uploads"
PUBLIC_FOLDER = os.path.join("frontend", "public")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/analyze", methods=["POST"])
def analyze():
    file = request.files.get("video")
    if not file:
        return jsonify({"error": "No video uploaded"}), 400

    filename   = f"{uuid.uuid4()}_{file.filename}"
    video_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(video_path)

    result = subprocess.run(
        ["python", "analyzer.py", video_path, "--output_dir", "./output"],
        capture_output=True, text=True,
        cwd=os.path.dirname(os.path.abspath(__file__))  # always run from project root
    )

    if result.returncode != 0:
        print("STDERR:", result.stderr)
        return jsonify({"error": result.stderr}), 500

    # Copy web_input.txt → frontend/public/web_input.txt
    src = "web_input.txt"
    dst = os.path.join(PUBLIC_FOLDER, "web_input.txt")
    if not os.path.exists(src):
        return jsonify({"error": "web_input.txt was not created by analyzer.py"}), 500
    shutil.copy(src, dst)

    # Read summary from analysis.json
    summary = {}
    analysis_json_path = os.path.join("output", "analysis.json")
    if os.path.exists(analysis_json_path):
        with open(analysis_json_path) as f:
            analysis = json.load(f)
        raw_summary  = analysis.get("summary", {})
        smash_count  = sum(
            sum(1 for s in pdata.get("shot_detections", []) if s["type"] == "smash")
            for pdata in analysis.get("players", {}).values()
        )
        summary = {
            "total_shots":      raw_summary.get("total_shots", 0),
            "shots_breakdown":  {"smash": smash_count},
            "shots_per_minute": raw_summary.get("shots_per_minute", 0),
        }

    # Clean up uploaded video
    try:
        os.remove(video_path)
    except Exception:
        pass

    return jsonify({"status": "ok", "summary": summary})

if __name__ == "__main__":
    app.run(debug=True, port=8001)
