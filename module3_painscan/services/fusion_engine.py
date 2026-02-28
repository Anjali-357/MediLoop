def fuse_modalities(face_score: int, resp_data: dict, audio_data: dict, agitation_data: dict, rppg_data: dict) -> dict:
    '''
    Weighs and scores multiple physiological parameters:
    0.4 * facial_score + 0.2 * respiration_stress + 0.2 * agitation + 0.2 * cardio_stress
    
    Dynamically reweighs if modalities are missing/offline.
    Returns: unified pain score, risk level, and active modalities list.
    '''
    active_weights = 0.0
    total_score = 0.0
    modalities = ["facial"]
    
    # Facial expression remains primary (starts at weight 0.4)
    if face_score is not None:
        active_weights += 0.4
        total_score += (face_score * 0.4)

    # 1. Respiration Modality
    resp_rate = resp_data.get("resp_rate")
    if resp_rate is not None:
        # Normalize stress from 20 to 50 bpm representing 0-10 scale
        r_score = min(max((resp_rate - 20) / 3.0, 0), 10)
        total_score += (r_score * 0.2)
        active_weights += 0.2
        modalities.append("respiration")

    # 2. Audio Cry Modality (Overrides Agitation weight if present for pediatric logic)
    cry_int = audio_data.get("cry_intensity")
    if cry_int is not None:
        a_score = cry_int * 10
        total_score += (a_score * 0.2)
        active_weights += 0.2
        modalities.append("audio_cry")
    else:
        # Agitation fallback if no audio is present
        agitation = agitation_data.get("agitation_score")
        if agitation is not None:
            total_score += (agitation * 0.2)
            active_weights += 0.2
            modalities.append("agitation")

    # 3. rPPG / Heart Rate Modality
    hr = rppg_data.get("heart_rate")
    if hr is not None and rppg_data.get("pulse_confidence", 0) > 0.4:
        # Normalize 60-120 bpm to 0-10 scale
        c_score = min(max((hr - 60) / 6.0, 0), 10)
        total_score += (c_score * 0.2)
        active_weights += 0.2
        modalities.append("rppg")

    # Dynamic reweight calculation if modalities are missing
    if active_weights > 0:
        final_score = int(round(total_score / active_weights))
    else:
        final_score = face_score or 0

    # Risk level calculation
    risk_level = "LOW"
    if final_score >= 8:
        risk_level = "HIGH"
    elif final_score >= 5:
        risk_level = "MODERATE"
        
    # Safety upgrade constraint - severe physiological warnings
    if resp_data.get("resp_distress") or audio_data.get("distress_audio"):
        risk_level = "HIGH"
        final_score = max(final_score, 7) # Floor severe physical distress
        
    return {
        "final_pain_score": final_score,
        "risk_level": risk_level,
        "modalities_used": modalities
    }
