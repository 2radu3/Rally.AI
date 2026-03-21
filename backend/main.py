import cv2
import os
import shutil
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_video(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cap = cv2.VideoCapture(temp_path)
    # Algoritm de detectare a mișcării
    fgbg = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=50, detectShadows=True)
    
    heatmap_data = []
    frame_idx = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret or frame_idx > 500: break
        
        # Procesăm 1 din 5 cadre
        if frame_idx % 5 == 0:
            # 1. Aplicăm masca de mișcare
            fgmask = fgbg.apply(frame)
            
            # 2. Curățăm imaginea (eliminăm zgomotul mic)
            _, fgmask = cv2.threshold(fgmask, 200, 255, cv2.THRESH_BINARY)
            contours, _ = cv2.findContours(fgmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if contours:
                # Luăm cel mai mare obiect care se mișcă (presupunem că e jucătorul)
                largest_contour = max(contours, key=cv2.contourArea)
                if cv2.contourArea(largest_contour) > 500: # Filtru de mărime
                    (x, y, w, h) = cv2.boundingRect(largest_contour)
                    
                    # Coordonatele centrului obiectului (normalizate 0-1)
                    center_x = (x + w // 2) / frame.shape[1]
                    center_y = (y + h // 2) / frame.shape[0]
                    
                    heatmap_data.append({"x": round(center_x, 3), "y": round(center_y, 3)})

        frame_idx += 1

    cap.release()
    if os.path.exists(temp_path): os.remove(temp_path)

    return {
        "status": "success",
        "points": heatmap_data,
        "count": len(heatmap_data),
        "method": "OpenCV Motion Tracking"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)