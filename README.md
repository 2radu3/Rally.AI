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
