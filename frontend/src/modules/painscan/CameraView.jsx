import React, { useRef, useState, useEffect } from 'react';

export default function CameraView({ onComplete, patientId, followupId }) {
    const videoRef = useRef(null);
    const [countdown, setCountdown] = useState(10);
    const [feedback, setFeedback] = useState('Position face in frame');
    const [scores, setScores] = useState([]);
    const canvasRef = useRef(document.createElement('canvas'));

    const [audioB64, setAudioB64] = useState(null);
    const mediaRecorderRef = useRef(null);

    useEffect(() => {
        let stream;
        const startCamera = async () => {
            try {
                // Multimodal Upgrade: Request both video and audio
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: true
                });

                if (videoRef.current) videoRef.current.srcObject = stream;

                // Set up Audio MediaRecorder to capture chunks parallel to frames
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = async (e) => {
                    if (e.data.size > 0) {
                        const reader = new FileReader();
                        reader.readAsDataURL(e.data);
                        reader.onloadend = () => setAudioB64(reader.result);
                    }
                };

                // Request 1-second chunks matches frame-capture rate
                mediaRecorder.start(1000);

            } catch (err) {
                setFeedback('Camera or Microphone access denied');
            }
        };
        startCamera();
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, []);

    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            captureFrame();
        } else {
            submitFinalScore();
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const captureFrame = async () => {
        if (!videoRef.current || !videoRef.current.videoWidth) return;
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL('image/jpeg', 0.8);

        try {
            const payload = { image: b64 };
            if (audioB64) payload.audio_chunk = audioB64;

            const res = await fetch('http://localhost:8000/api/painscan/analyze-frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success && data.data.face_detected) {
                setFeedback('Good... Keep still');
                // Store complex multimodal trace instead of just scalar scores
                setScores(prev => [...prev, data.data]);
            } else {
                setFeedback(data.message || 'Move closer');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const submitFinalScore = async () => {
        try {
            // Aggregate multimodal scores array safely 
            const frame_scores = scores.map(s => s.score);
            let payload = { patient_id: patientId, followup_id: followupId, frame_scores: frame_scores };

            if (scores.length > 0) {
                const latest = scores[scores.length - 1]; // Use ultimate state trajectory
                payload.resp_rate = latest.resp_rate;
                payload.heart_rate = latest.heart_rate;
                payload.cry_intensity = latest.cry_intensity;
                payload.agitation_score = latest.agitation_score;
                payload.risk_level = latest.risk_level;
                payload.modalities_used = latest.modalities_used;
            }

            const res = await fetch('http://localhost:8000/api/painscan/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                // Pass full multimodal doc up to Index Router
                onComplete(data.data);
            } else {
                setFeedback('Failed to save multimodal score.');
            }
        } catch (err) {
            console.error(err);
            setFeedback('Error connecting to server.');
        }
    };

    return (
        <div className="camera-view fade-in">
            <div className="camera-border animated-border multimodal-rings">
                <video ref={videoRef} autoPlay playsInline muted />
            </div>
            <div className="overlay">
                <div className="countdown">{countdown}s</div>
                <div className="feedback-box">
                    <p className="feedback">{feedback}</p>
                </div>
            </div>
        </div>
    );
}
