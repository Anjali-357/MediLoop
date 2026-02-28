import cv2
import base64
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import joblib
import os
import asyncio

# Multimodal Services
from .services.respiration import estimate_respiration
from .services.audio_analysis import analyze_audio
from .services.agitation import compute_agitation
from .services.rppg import estimate_rppg
from .services.fusion_engine import fuse_modalities

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
PROTOTXT = os.path.join(MODEL_DIR, "deploy.prototxt")
CAFFEMODEL = os.path.join(MODEL_DIR, "res10_300x300_ssd_iter_140000.caffemodel")
MP_MODEL_PATH = os.path.join(MODEL_DIR, "face_landmarker.task")
SVM_MODEL_PATH = os.path.join(os.path.dirname(__file__), "pain_model.pkl")

# Initialize MediaPipe Face Landmarker
base_options = python.BaseOptions(model_asset_path=MP_MODEL_PATH)
options = vision.FaceLandmarkerOptions(
    base_options=base_options,
    output_face_blendshapes=False,
    output_facial_transformation_matrixes=False,
    num_faces=1
)
face_landmarker = vision.FaceLandmarker.create_from_options(options)

# Load OpenCV Face Detector
try:
    net = cv2.dnn.readNetFromCaffe(PROTOTXT, CAFFEMODEL)
except Exception:
    net = None

# Load SVM Model
try:
    svm_model = joblib.load(SVM_MODEL_PATH)
except Exception:
    svm_model = None

def base64_to_image(b64_string: str):
    if b64_string.startswith("data:"):
        # e.g. "data:image/jpeg;base64,....." -> get the latter part
        b64_string = b64_string.split(",")[1]
    
    try:
        img_data = base64.b64decode(b64_string)
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        # Gracefully handle improperly padded or invalid b64 strings
        return None

def detect_face(image):
    if not hasattr(net, "empty") or net.empty():
        return image
        
    h, w = image.shape[:2]
    blob = cv2.dnn.blobFromImage(cv2.resize(image, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
    net.setInput(blob)
    detections = net.forward()
    
    max_confidence = 0
    best_box = None
    
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence > 0.5 and confidence > max_confidence:
            max_confidence = confidence
            box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
            best_box = box.astype("int")
            
    if best_box is None:
        return None
        
    startX, startY, endX, endY = best_box
    pad_y = int((endY - startY) * 0.1)
    pad_x = int((endX - startX) * 0.1)
    
    startY = max(0, startY - pad_y)
    endY = min(h, endY + pad_y)
    startX = max(0, startX - pad_x)
    endX = min(w, endX + pad_x)
    
    return image[startY:endY, startX:endX]

def extract_landmarks(image):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    
    # Process
    try:
        results = face_landmarker.detect(mp_image)
    except Exception:
        return None
        
    if not results.face_landmarks:
        return None
    
    landmarks = results.face_landmarks[0]
    
    def pt(idx):
        return np.array([landmarks[idx].x, landmarks[idx].y])
    
    def dist(idx1, idx2):
        return np.linalg.norm(pt(idx1) - pt(idx2))

    # Calculate Face Bounding Box for Normalization
    ys = [lm.y for lm in landmarks]
    xs = [lm.x for lm in landmarks]
    face_height = max(ys) - min(ys)
    face_width = max(xs) - min(xs)
    if face_height == 0: face_height = 0.01
    if face_width == 0: face_width = 0.01

    # Heuristic Features based on Facial Action Coding System (FACS)
    
    # AU4 - Brow Lowerer (Corrugator)
    left_brow_lower = dist(105, 336) / face_width # Distance between inner brows
    brow_furrow = dist(10, 151) / face_height # Distance from nasal root to mid forehead

    # AU6 / AU7 - Cheek Raiser / Lid Tightener (Squinting/Crying)
    left_eye_height = dist(159, 145) / face_height
    right_eye_height = dist(386, 374) / face_height
    eye_squint = (left_eye_height + right_eye_height) / 2.0

    # AU10 - Upper Lip Raiser (Disgust/Pain)
    nasolabial_fold = dist(2, 0) / face_height # Distance from nose tip to upper lip

    # AU20/26 - Lip Stretcher / Jaw Drop (Crying / Screaming)
    mouth_width = dist(61, 291) / face_width
    mouth_height = dist(13, 14) / face_height
    
    # Additional Crying indicators
    # Pulling down of lip corners (AU15)
    left_lip_corner_drop = dist(61, 206) / face_height
    right_lip_corner_drop = dist(291, 426) / face_height
    lip_corner_drop = (left_lip_corner_drop + right_lip_corner_drop) / 2.0

    features = {
        "brow_lower": left_brow_lower,
        "brow_furrow": brow_furrow,
        "eye_squint": eye_squint,
        "upper_lip_raise": nasolabial_fold,
        "mouth_stretch": mouth_width,
        "mouth_open": mouth_height,
        "lip_drop": lip_corner_drop
    }
    
    return features

def predict_score(features):
    score = 0
    
    # Heuristics rules tailored for identifying crying & distress
    
    # 1. Brow Lowering / Furrowing (Max +3)
    # The inner brows are pulled together and down
    if features["brow_lower"] < 0.12: score += 1
    if features["brow_lower"] < 0.09: score += 2
    
    # 2. Eye Squeeze / Squinting (Max +3)
    # Eyes are tightly shut or squinted while crying
    if features["eye_squint"] < 0.05: score += 1
    if features["eye_squint"] < 0.035: score += 2
    
    # 3. Mouth Open / Stretched (Max +3)
    # Crying/wailing usually involves an open, stretched mouth
    if features["mouth_open"] > 0.08: score += 1
    if features["mouth_open"] > 0.15: score += 1
    if features["mouth_stretch"] > 0.40: score += 1
    
    # 4. Lip Corner Depression (Max +1)
    # Frowning / sad expression
    if features["lip_drop"] > 0.18: score += 1
    
    # Ensures score is capped cleanly between 0 and 10
    final_score = min(max(int(score), 0), 10)
    
    return final_score

async def process_frame(b64_string: str, audio_chunk_b64: str = None):
    image = base64_to_image(b64_string)
    if image is None:
        return {"face_detected": False}
        
    face_crop = detect_face(image)
    if face_crop is None:
        return {"face_detected": False}
        
    features = extract_landmarks(face_crop)
    if features is None:
        return {"face_detected": False}
        
    face_score = predict_score(features)
    
    # Run Multimodal Inference Concurrently for Latency (<150ms)
    results = await asyncio.gather(
        estimate_respiration(image, face_crop),
        analyze_audio(audio_chunk_b64),
        compute_agitation(image),
        estimate_rppg(face_crop)
    )
    
    resp_data, audio_data, agitation_data, rppg_data = results
    
    # Fuse All Modalities
    fusion_result = fuse_modalities(face_score, resp_data, audio_data, agitation_data, rppg_data)
    
    # Assemble unified response object
    payload = {
        "face_detected": True,
        "score": fusion_result["final_pain_score"],
        "risk_level": fusion_result["risk_level"],
        "modalities_used": fusion_result["modalities_used"],
    }
    
    # Safely attach optional physiological measurements
    if resp_data.get("resp_rate") is not None: payload["resp_rate"] = resp_data["resp_rate"]
    if audio_data.get("cry_intensity") is not None: payload["cry_intensity"] = audio_data["cry_intensity"]
    if agitation_data.get("agitation_score") is not None: payload["agitation_score"] = agitation_data["agitation_score"]
    if rppg_data.get("heart_rate") is not None: payload["heart_rate"] = rppg_data["heart_rate"]
        
    return payload
