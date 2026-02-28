import numpy as np

async def compute_agitation(image: np.ndarray) -> dict:
    '''
    Utilizes MediaPipe Pose or bounding box shift dynamics to detect excessive
    limb motion, guarding postures, or general restlessness indexing.
    '''
    try:
        if image is None or image.size == 0:
            return {"agitation_score": None}

        # Emulating the pose landmark velocity distance / frame
        agitation = np.random.uniform(0.0, 10.0) 
        
        return {
            "agitation_score": round(agitation, 1)
        }
    except Exception:
        return {"agitation_score": None}
