import cv2
import mediapipe as mp
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from collections import defaultdict
import argparse
import os

# --- Configuration ---
# Define court dimensions (approximate, normalized coordinates 0-1 for width, 0-1 for height)
# Assume the camera view captures the court reasonably well
# Padel court is roughly 10m x 20m. Let's map this to a 0-1 coordinate system for width/height.
# For simplicity, assume the camera is fixed and centered on the court.
# Define zones for potential shot classification (e.g., forehand/backhand, baseline/volley)
FOREHAND_ZONE_X_MIN = 0.2
FOREHAND_ZONE_X_MAX = 0.8
BACKHAND_ZONE_X_MIN = 0.2
BACKHAND_ZONE_X_MAX = 0.8
BASELINE_ZONE_Y_THRESHOLD = 0.7 # Below this line is baseline play
VOLLEY_ZONE_Y_THRESHOLD = 0.4  # Above this line is volley/net play

# --- Setup MediaPipe Pose ---
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1, # 0: Lite, 1: Full, 2: Heavy. Balance speed/accuracy.
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)
mp_drawing = mp.solutions.drawing_utils

# --- Helper Functions ---

def calculate_angle(p1, p2, p3):
    """Calculates angle between three points (p2 is vertex)."""
    a = np.array([p1.x, p1.y]) # First point
    b = np.array([p2.x, p2.y]) # Vertex
    c = np.array([p3.x, p3.y]) # Third point

    ba = a - b
    bc = c - b

    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))

    return np.degrees(angle)

def get_player_position(landmarks):
    """Estimates player position using hip center."""
    if not landmarks:
        return None
    try:
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP.value]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value]
        avg_x = (left_hip.x + right_hip.x) / 2
        avg_y = (left_hip.y + right_hip.y) / 2
        return {'x': avg_x, 'y': avg_y}
    except IndexError:
        # Landmarks might be missing if person is partially out of frame
        return None

def classify_shot(landmarks, prev_landmarks=None):
    """Attempts to classify a shot based on pose."""
    if not landmarks or not prev_landmarks:
        return None, 0.0 # Cannot classify without current and previous data

    try:
        # --- Example Shot Classification Logic ---
        # This is a simplified heuristic. Real classification requires ML models trained on Padel data.
        # Focus on arm and racket (if visible) movement relative to body.

        # Get key points
        left_wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
        right_wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value]
        left_elbow = landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value]
        right_elbow = landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value]
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]

        # Get previous frame points
        prev_left_wrist = prev_landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
        prev_right_wrist = prev_landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value]
        prev_left_elbow = prev_landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value]
        prev_right_elbow = prev_landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value]

        # Calculate velocities (simple displacement over time)
        lw_vel = np.sqrt((left_wrist.x - prev_left_wrist.x)**2 + (left_wrist.y - prev_left_wrist.y)**2)
        rw_vel = np.sqrt((right_wrist.x - prev_right_wrist.x)**2 + (right_wrist.y - prev_right_wrist.y)**2)
        le_vel = np.sqrt((left_elbow.x - prev_left_elbow.x)**2 + (left_elbow.y - prev_left_elbow.y)**2)
        re_vel = np.sqrt((right_elbow.x - prev_right_elbow.x)**2 + (right_elbow.y - prev_right_elbow.y)**2)

        # Example: High velocity wrist movement upwards might indicate a smash or overhead
        if max(lw_vel, rw_vel) > 0.02 and (left_wrist.y < left_shoulder.y or right_wrist.y < right_shoulder.y): # Wrist above shoulder
            return 'smash_overhead', 0.8

        # Example: Elbow moving forward quickly might indicate a drive
        if max(le_vel, re_vel) > 0.015 and (left_elbow.x > prev_left_elbow.x or right_elbow.x > prev_right_elbow.x): # Moving towards opponent side (assuming right is opponent)
            # Determine forehand/backhand based on shoulder position relative to hip center
            hip_center_x = (landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x + landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x) / 2
            if (left_shoulder.x > hip_center_x or right_shoulder.x): # Shoulder further right -> Forehand
                return 'forehand_drive', 0.7
            else: # Shoulder further left -> Backhand
                return 'backhand_drive', 0.7

        # Example: Wrist moving downwards quickly might indicate a slice or drop shot
        if abs(left_wrist.y - prev_left_wrist.y) > 0.015 or abs(right_wrist.y - prev_right_wrist.y) > 0.015:
             if (left_wrist.y > prev_left_wrist.y or right_wrist.y > prev_right_wrist.y): # Moving down
                 # Check if near net area (y > 0.6 maybe?)
                 player_pos = get_player_position(landmarks)
                 if player_pos and player_pos['y'] > 0.6: # Near net
                     return 'drop_shot', 0.6
                 else:
                     return 'slice', 0.6

        # If no strong indicator found, return None
        return None, 0.0

    except IndexError:
        # Landmarks might be missing
        return None, 0.0


def main():
    parser = argparse.ArgumentParser(description='Analyze a Padel video for shots and movement.')
    parser.add_argument('video_path', type=str, help='Path to the input video file')
    parser.add_argument('--output_dir', type=str, default='./output', help='Directory to save output images (default: ./output)')
    parser.add_argument('--heatmap_size', type=int, nargs=2, default=[50, 100], help='Size of the movement heatmap grid (rows, cols) (default: 50 100)')

    args = parser.parse_args()

    if not os.path.exists(args.video_path):
        print(f"Error: Video file '{args.video_path}' not found.")
        return

    os.makedirs(args.output_dir, exist_ok=True)

    cap = cv2.VideoCapture(args.video_path)
    if not cap.isOpened():
        print(f"Error: Cannot open video file '{args.video_path}'.")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    print(f"Processing video: {args.video_path}")
    print(f"Duration: {duration:.2f}s, FPS: {fps:.2f}, Total Frames: {total_frames}")

    # Data storage
    shot_detections = []
    movement_positions = []
    prev_landmarks = None # Store landmarks from the previous frame for velocity/angle calculations
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_time = frame_count / fps

        # Process frame with MediaPipe
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(image_rgb)

        current_landmarks = results.pose_landmarks.landmark if results.pose_landmarks else None

        # Estimate player position
        player_pos = get_player_position(results.pose_landmarks)
        if player_pos:
            movement_positions.append(player_pos)

        # Attempt shot classification using current and previous landmarks
        if current_landmarks and prev_landmarks:
            shot_type, confidence = classify_shot(current_landmarks, prev_landmarks)
            if shot_type:
                shot_detections.append({
                    'timestamp': frame_time,
                    'type': shot_type,
                    'confidence': confidence,
                    'playerPosition': player_pos # Associate shot with player position
                })

        # Update previous landmarks for next iteration
        prev_landmarks = current_landmarks

        frame_count += 1
        # Print progress every 10%
        if frame_count % max(1, total_frames // 10) == 0:
            progress = (frame_count / total_frames) * 100
            print(f"Processing... {progress:.1f}% complete ({frame_count}/{total_frames})")

    cap.release()
    print(f"Analysis complete. Found {len(shot_detections)} potential shots.")

    # --- Generate Outputs ---

    # 1. Movement Heatmap
    if movement_positions:
        print("Generating movement heatmap...")
        heatmap_resolution = args.heatmap_size # [rows, cols] -> [height, width]
        heatmap, xedges, yedges = np.histogram2d(
            [pos['x'] for pos in movement_positions],
            [pos['y'] for pos in movement_positions],
            bins=heatmap_resolution,
            range=[[0, 1], [0, 1]] # Normalize coordinates to 0-1
        )

        # Plot heatmap using Seaborn
        plt.figure(figsize=(12, 6))
        sns.heatmap(heatmap.T, cmap='viridis', origin='lower', extent=[0, 1, 0, 1], cbar_kws={'label': 'Frequency'})
        plt.xlabel('Court Width Normalized (0-1)')
        plt.ylabel('Court Height Normalized (0-1)')
        plt.title('Player Movement Frequency Heatmap')
        plt.gca().invert_yaxis() # Invert Y axis so 0,0 is top-left like an image
        plt.tight_layout()
        heatmap_path = os.path.join(args.output_dir, 'movement_heatmap.png')
        plt.savefig(heatmap_path)
        plt.close() # Close figure to free memory
        print(f"Movement heatmap saved to: {heatmap_path}")
    else:
        print("No player positions detected for heatmap.")


    # 2. Shot Detection Summary
    if shot_detections:
        print("\n--- Shot Detection Summary ---")
        shot_counts = defaultdict(int)
        for shot in shot_detections:
            shot_counts[shot['type']] += 1
            # Optional: Print individual detections (verbose)
            # print(f"Time: {shot['timestamp']:.2f}s, Shot: {shot['type']}, Conf: {shot['confidence']:.2f}")

        for shot_type, count in shot_counts.items():
            print(f"{shot_type.replace('_', ' ').title()}: {count}")

        # Optional: Plot shot distribution over time
        timestamps = [s['timestamp'] for s in shot_detections]
        shot_types = [s['type'] for s in shot_detections]

        unique_shots = sorted(set(shot_types))
        shot_to_num = {shot: i for i, shot in enumerate(unique_shots)}
        shot_numbers = [shot_to_num[s] for s in shot_types]

        plt.figure(figsize=(12, 6))
        plt.scatter(timestamps, shot_numbers, alpha=0.6, s=20)
        plt.yticks(range(len(unique_shots)), [s.replace('_', ' ').title() for s in unique_shots])
        plt.xlabel('Time (seconds)')
        plt.ylabel('Shot Type')
        plt.title('Shot Types Over Time')
        plt.grid(axis='y', linestyle='--', alpha=0.7)
        plt.tight_layout()
        shots_over_time_path = os.path.join(args.output_dir, 'shots_over_time.png')
        plt.savefig(shots_over_time_path)
        plt.close()
        print(f"Shot distribution plot saved to: {shots_over_time_path}")
    else:
        print("\nNo shots detected.")


    # 3. Optional: Save raw data (JSON format)
    import json
    output_json_path = os.path.join(args.output_dir, 'analysis_output.json')
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
    with open(output_json_path, 'w') as f:
        json.dump(output_data, f, indent=2)
    print(f"Raw analysis data saved to: {output_json_path}")

    print("\nAll outputs generated successfully!")


if __name__ == "__main__":
    main()