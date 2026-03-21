import cv2
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from collections import defaultdict
import argparse
import os
from ultralytics import YOLO

# --- Configuration ---
FOREHAND_ZONE_X_MIN = 0.2
FOREHAND_ZONE_X_MAX = 0.8
BACKHAND_ZONE_X_MAX = 0.8
BASELINE_ZONE_Y_THRESHOLD = 0.7
VOLLEY_ZONE_Y_THRESHOLD = 0.4

# --- Load YOLOv8 Pose Model ---
print("Loading YOLOv8n-pose model...")
try:
    model = YOLO("yolov8n-pose.pt")  # Downloads automatically on first run
    print("✅ Model loaded successfully.")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    print("Please run: pip install ultralytics")
    exit(1)

def get_player_position(keypoints_xy, confidences):
    """Estimate player position using hip keypoints + confidence."""
    if len(keypoints_xy) < 13:
        return None
    left_hip = keypoints_xy[11]   # [x, y]
    right_hip = keypoints_xy[12]  # [x, y]
    left_hip_conf = confidences[11]
    right_hip_conf = confidences[12]

    if left_hip_conf < 0.5 or right_hip_conf < 0.5:
        return None

    avg_x, avg_y = (left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2
    return {'x': avg_x / 1920, 'y': avg_y / 1080}  # Normalize to 0–1 (assuming 1920x1080)

def classify_shot(keypoints_xy, confidences, prev_keypoints_xy, prev_confidences):
    """Classify shot type using keypoints and confidence scores."""
    if (prev_keypoints_xy is None or 
        len(keypoints_xy) < 17 or 
        len(prev_keypoints_xy) < 17):
        return None, 0.0

    try:
        # COCO keypoint indices:
        # 5: left_shoulder, 6: right_shoulder, 7: left_elbow, 8: right_elbow,
        # 9: left_wrist, 10: right_wrist, 11: left_hip, 12: right_hip
        l_wrist = keypoints_xy[9]
        r_wrist = keypoints_xy[10]
        l_elbow = keypoints_xy[7]
        r_elbow = keypoints_xy[8]
        l_shoulder = keypoints_xy[5]
        r_shoulder = keypoints_xy[6]

        prev_l_wrist = prev_keypoints_xy[9]
        prev_r_wrist = prev_keypoints_xy[10]
        prev_l_elbow = prev_keypoints_xy[7]
        prev_r_elbow = prev_keypoints_xy[8]

        l_wrist_conf = confidences[9]
        r_wrist_conf = confidences[10]
        l_elbow_conf = confidences[7]
        r_elbow_conf = confidences[8]

        # Normalize velocity by frame width (1920)
        lw_vel = np.sqrt((l_wrist[0] - prev_l_wrist[0])**2 + (l_wrist[1] - prev_l_wrist[1])**2) / 1920
        rw_vel = np.sqrt((r_wrist[0] - prev_r_wrist[0])**2 + (r_wrist[1] - prev_r_wrist[1])**2) / 1920
        le_vel = np.sqrt((l_elbow[0] - prev_l_elbow[0])**2 + (l_elbow[1] - prev_l_elbow[1])**2) / 1920
        re_vel = np.sqrt((r_elbow[0] - prev_r_elbow[0])**2 + (r_elbow[1] - prev_r_elbow[1])**2) / 1920

        # 1. Smash/Overhead: fast upward wrist + wrist above shoulder + good confidence
        if (max(lw_vel, rw_vel) > 0.015 and
            ((l_wrist[1] < l_shoulder[1] and l_wrist_conf > 0.5) or
             (r_wrist[1] < r_shoulder[1] and r_wrist_conf > 0.5))):
            return 'smash_overhead', 0.75

        # 2. Drive: forward elbow motion + confidence
        if (max(le_vel, re_vel) > 0.01 and
            ((l_elbow[0] > prev_l_elbow[0] and l_elbow_conf > 0.5) or
             (r_elbow[0] > prev_r_elbow[0] and r_elbow_conf > 0.5))):
            hip_center_x = (keypoints_xy[11][0] + keypoints_xy[12][0]) / 2
            if l_shoulder[0] > hip_center_x or r_shoulder[0] > hip_center_x:
                return 'forehand_drive', 0.65
            else:
                return 'backhand_drive', 0.65

        # 3. Drop shot: downward wrist motion near net (high y = near bottom of screen)
        if (abs(l_wrist[1] - prev_l_wrist[1]) > 0.02 or abs(r_wrist[1] - prev_r_wrist[1]) > 0.02):
            if (l_wrist[1] > prev_l_wrist[1] or r_wrist[1] > prev_r_wrist[1]):  # moving down
                pos = get_player_position(keypoints_xy, confidences)
                if pos and pos['y'] > 0.6:  # near net (bottom 40% of court)
                    return 'drop_shot', 0.6

        return None, 0.0
    except Exception as e:
        # Uncomment for debugging: print(f"Shot classification error: {e}")
        return None, 0.0

def main():
    parser = argparse.ArgumentParser(description='Analyze Padel video using YOLOv8 pose')
    parser.add_argument('video_path', type=str, help='Path to input video file')
    parser.add_argument('--output_dir', type=str, default='./output', help='Directory to save outputs')
    parser.add_argument('--heatmap_size', type=int, nargs=2, default=[50, 100], help='Heatmap grid size [rows, cols]')
    args = parser.parse_args()

    if not os.path.exists(args.video_path):
        print(f"❌ Error: Video file '{args.video_path}' not found.")
        return

    os.makedirs(args.output_dir, exist_ok=True)

    cap = cv2.VideoCapture(args.video_path)
    if not cap.isOpened():
        print(f"❌ Error: Could not open video '{args.video_path}'.")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    print(f"▶️ Processing: {args.video_path}")
    print(f"   Duration: {duration:.1f}s | FPS: {fps:.1f} | Frames: {total_frames}")

    shot_detections = []
    movement_positions = []
    prev_keypoints_xy = None
    prev_confidences = None
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_time = frame_count / fps

        # Run YOLOv8 pose inference
        try:
            results = model(frame, verbose=False, imgsz=640)
        except Exception as e:
            print(f"⚠️ Inference error at frame {frame_count}: {e}")
            frame_count += 1
            continue

        if not results or len(results[0].keypoints.xy) == 0:
            frame_count += 1
            continue

        # Extract keypoints (x, y) and confidences
        keypoints_xy = results[0].keypoints.xy[0].cpu().numpy()      # shape (17, 2)
        confidences = results[0].keypoints.conf[0].cpu().numpy()    # shape (17,)

        player_pos = get_player_position(keypoints_xy, confidences)
        if player_pos:
            movement_positions.append(player_pos)

        # Classify shot if we have previous frame
        if prev_keypoints_xy is not None and prev_confidences is not None:
            shot_type, conf = classify_shot(
                keypoints_xy, confidences,
                prev_keypoints_xy, prev_confidences
            )
            if shot_type:
                shot_detections.append({
                    'timestamp': frame_time,
                    'type': shot_type,
                    'confidence': conf,
                    'playerPosition': player_pos
                })

        # Update for next frame
        prev_keypoints_xy = keypoints_xy
        prev_confidences = confidences
        frame_count += 1

        if frame_count % max(1, total_frames // 10) == 0:
            print(f"⏳ {frame_count}/{total_frames} ({frame_count/total_frames*100:.1f}%)")

    cap.release()
    print(f"\n✅ Analysis complete. Detected {len(shot_detections)} shots.")

    # --- Generate Outputs ---
    if movement_positions:
        print("📈 Generating movement heatmap...")
        try:
            heatmap, xedges, yedges = np.histogram2d(
                [p['x'] for p in movement_positions],
                [p['y'] for p in movement_positions],
                bins=args.heatmap_size,
                range=[[0, 1], [0, 1]]
            )

            plt.figure(figsize=(12, 6))
            sns.heatmap(
                heatmap.T,
                cmap='viridis',
                cbar_kws={'label': 'Frequency'},
                xticklabels=5,
                yticklabels=5
            )
            plt.xlabel('Court Width (0 → 1)')
            plt.ylabel('Court Height (1 → 0)')  # 1=top, 0=bottom after invert
            plt.title('Player Movement Heatmap')
            plt.gca().invert_yaxis()  # Critical: flip so (0,0) is top-left like video
            plt.tight_layout()
            heatmap_path = os.path.join(args.output_dir, 'movement_heatmap.png')
            plt.savefig(heatmap_path, dpi=100)
            plt.close()
            print(f"✅ Heatmap saved: {heatmap_path}")
        except Exception as e:
            print(f"⚠️ Failed to generate heatmap: {e}")

    if shot_detections:
        print("\n🎯 Shot Summary:")
        counts = defaultdict(int)
        for s in shot_detections:
            counts[s['type']] += 1
        for k, v in counts.items():
            print(f"  {k.replace('_', ' ').title()}: {v}")

        # Plot shots over time
        try:
            timestamps = [s['timestamp'] for s in shot_detections]
            types = [s['type'] for s in shot_detections]
            unique = sorted(set(types))
            num_map = {t: i for i, t in enumerate(unique)}
            y_vals = [num_map[t] for t in types]

            plt.figure(figsize=(12, 6))
            plt.scatter(timestamps, y_vals, alpha=0.7, s=30, color='tab:blue')
            plt.yticks(range(len(unique)), [t.replace('_', ' ').title() for t in unique])
            plt.xlabel('Time (seconds)')
            plt.title('Shot Types Over Time')
            plt.grid(axis='y', linestyle='--', alpha=0.5)
            shots_path = os.path.join(args.output_dir, 'shots_over_time.png')
            plt.savefig(shots_path, dpi=100)
            plt.close()
            print(f"✅ Shot timeline saved: {shots_path}")
        except Exception as e:
            print(f"⚠️ Failed to plot shots: {e}")

    # Save JSON
    import json
    output_data = {
        'video_info': {
            'path': args.video_path,
            'duration_seconds': duration,
            'fps': fps,
            'total_frames': total_frames
        },
        'shot_detections': shot_detections,
        'movement_positions': movement_positions
    }
    json_path = os.path.join(args.output_dir, 'analysis.json')
    try:
        with open(json_path, 'w') as f:
            json.dump(output_data, f, indent=2)
        print(f"✅ JSON saved: {json_path} ({os.path.getsize(json_path)/1024:.1f} KB)")
    except Exception as e:
        print(f"⚠️ Failed to save JSON: {e}")

    print(f"\n📁 All outputs saved to: {args.output_dir}/")

if __name__ == "__main__":
    main()