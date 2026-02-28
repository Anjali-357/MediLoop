import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, Activity } from 'lucide-react';

const RecordingPanel = ({ sessionId, transcript, setTranscript, onRecordingStop }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    const wsRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);
    const chunksRef = useRef([]);
    const chunkTimerRef = useRef(null);

    useEffect(() => {
        // Format timer
        if (isRecording && !isPaused) {
            timerRef.current = setInterval(() => {
                setElapsed(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording, isPaused]);

    const connectWebSocket = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return true;

        // In dev, assuming backend is on 8000
        const ws = new WebSocket(`ws://localhost:8000/api/scribe/ws/${sessionId}`);

        ws.onopen = () => console.log('Scribe WS Connected');

        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'transcript_update') {
                setTranscript(data.text);
            }
        };

        ws.onclose = () => console.log('Scribe WS Disconnected');

        wsRef.current = ws;
        return true;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            connectWebSocket();

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = []; // Reset chunks

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                    chunksRef.current.push(e.data);
                    // Combine all chunks so it's a valid webm with a header
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    wsRef.current.send(blob);
                }
            };

            mediaRecorder.start(); // Start without timeslice

            // Request chunks every 4 seconds manually without dropping the active WebM stream
            chunkTimerRef.current = setInterval(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                    mediaRecorderRef.current.requestData();
                }
            }, 4000);

            setIsRecording(true);
            setIsPaused(false);
        } catch (err) {
            console.error("Microphone access denied or error:", err);
            // Fallback for hackathon demo if no mic
            alert("Microphone access required for real-time transcription.");
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && isPaused) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (chunkTimerRef.current) {
            clearInterval(chunkTimerRef.current);
        }
        if (wsRef.current) {
            // Close socket after short delay to ensure last chunk is sent
            setTimeout(() => {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.close();
                }
            }, 1000);
        }
        setIsRecording(false);
        setIsPaused(false);
        onRecordingStop(); // Trigger SOAP note generation
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="card p-6 flex flex-col h-full bg-white border border-surface-200">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-bold text-surface-900 flex items-center">
                        <Mic className="w-5 h-5 mr-2 text-primary-500" />
                        Live Consultation
                    </h2>
                    <p className="text-sm text-surface-500">Capture conversation to generate SOAP</p>
                </div>

                <div className="flex items-center space-x-4">
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${isRecording && !isPaused ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : 'bg-surface-50 text-surface-400'}`}>
                        {isRecording && !isPaused && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>}
                        <span className="font-mono text-sm font-medium">{formatTime(elapsed)}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-surface-50 rounded-lg p-4 mb-6 overflow-y-auto border border-surface-100 relative">
                {transcript ? (
                    <div className="space-y-3">
                        <p className="text-surface-800 leading-relaxed text-sm format-whitespace">
                            {transcript}
                        </p>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-surface-400">
                        <Activity className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">Ready to listen...</p>
                    </div>
                )}
            </div>

            <div className="flex justify-center space-x-4">
                {!isRecording ? (
                    <button onClick={startRecording} className="btn-primary w-full max-w-xs">
                        <Mic className="w-4 h-4 mr-2" /> Start Recording
                    </button>
                ) : (
                    <>
                        {isPaused ? (
                            <button onClick={resumeRecording} className="btn-secondary w-full max-w-xs">
                                <Play className="w-4 h-4 mr-2" /> Resume
                            </button>
                        ) : (
                            <button onClick={pauseRecording} className="btn-secondary w-full max-w-xs">
                                <Pause className="w-4 h-4 mr-2" /> Pause
                            </button>
                        )}
                        <button onClick={stopRecording} className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 w-full max-w-xs">
                            <Square className="w-4 h-4 mr-2" /> Stop & Generate
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default RecordingPanel;
