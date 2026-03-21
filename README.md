# RallyAI 🏓💻

Most padel players hit a ceiling because they can't see what they're doing wrong.
Our solution: RallyAI - a performance platform that turns raw match footage into an analytics dashboard, making professional coatching accessible for the everyday player. 

## Features

### Core AI & Analytics 📈📊

* **Auto Shot Detection**: Automatically classifies *smashes*, *forehands*, *backhands* by calculating wrist velocity and skeletal positioning.
* **3D Intensity Heatmap**: A custom-build, interactive court visualization mapping player density and **hot zones**.

![3dview](s1.png)
![3dview](s2.png)

* **Session History**: Exports structured JSON data including movement patterns for session-over-session tracking.

### Tech Stack 🛠️💻

* Powered by [YOLOv8-Pose](https://github.com/ultralytics/ultralytics) for high-accuracy keypoint tracking.
* Features a global shot-cooldown logic to prevent double-counting and ensure clean data during the live demo.
* Visuals: Vanilla JS (3D Isometric Engine) & Matplotlib (Statistical Reports).

## Setup and run

### 1. Install dependencies
```bash
cd website
pip install -r requirements.txt
```

### 2. Start the server
```bash
python app.py
```

### 3. Open your browser
```
http://localhost:5000
```

---

### Plug in your analyzer.py

In `app.py`, find the `analyze_session` route and replace the mock block:

```python
# ── PLUG YOUR analyzer.py HERE ──────────────────────────
# from analyzer import analyze_video
# result = analyze_video(filepath)
```

Your `analyze_video(filepath)` function should return a dict with:
```python
{
    'shots_detected': int,
    'shot_types': {'forehand': int, 'backhand': int, ...},
    'avg_rally_length': float,      # seconds
    'court_coverage': float,         # 0-100 %
    'top_speed_kmh': float,
    'error_patterns': [str, ...],
    'drill_suggestions': [str, ...],
    'heatmap': [                     # list of court positions
        {'x': float, 'y': float, 'w': float},  # x,y,w all 0.0-1.0
        ...
    ],
}
```

## File structure
```
website/
├── app.py              ← Flask backend (all API routes)
├── analyzer.py         ← YOUR existing AI analyzer
├── requirements.txt
├── data/
│   └── sessions.json   ← auto-created, stores all session data
├── uploads/            ← video files stored here
├── static/
│   ├── css/style.css
│   └── js/app.js
└── templates/
    └── index.html
```
