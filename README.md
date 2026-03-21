# 🎾🏓 RallyAI[^1] | PadelCoach 

Most padel players hit a ceiling because they can't see what they're doing wrong.
Our solution: PadelAI - a performance platform that turns raw match footage into an analytics dashboard, making professional coatching accessible for the everyday player. 

## Features

### Core AI & Analytics 📈📊

* **Auto Shot Detection**: Automatically classifies *smashes*, *forehands*, *backhands* by calculating wrist velocity and skeletal positioning.
* **3D Intensity Heatmap**: A custom-build, interactive court visualization mapping player density and **hot zones**.
* **Session History**: Exports structured JSON data including movement patterns for session-over-session tracking.

### Tech Stack 🛠️💻

* Powered by [YOLOv8-Pose](https://github.com/ultralytics/ultralytics) for high-accuracy keypoint tracking.
* Features a global shot-cooldown logic to prevent double-counting and ensure clean data during the live demo.
* Visuals: Vanilla JS (3D Isometric Engine) & Matplotlib (Statistical Reports).

## 📦 Structure
```text
├── analyzer.py          # The "brain" — processes video and detects shots
├── heatmap.html         # The "viewer" — interactive 3D heatmap
├── requirements.txt     # What you need to install
└── output/              # Where your PNGs, JSON, and web data end up
```

## Requirements

### 1. Install dependencies
Ensure you have Python 3.8+ installed:
```bash
pip install opencv-python numpy matplotlib ultralytics
```




[^1]: Developed for the PadelCoach AI Hackathon Challenge