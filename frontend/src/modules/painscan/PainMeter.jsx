import React, { useState, useEffect } from 'react';

const EMOJIS = ['😁', '🙂', '😐', '😕', '😟', '😢', '😭', '😫', '😖', '😱', '😵'];

export default function PainMeter({ result }) {
    const [displayedScore, setDisplayedScore] = useState(0);

    const score = result?.score || 0;
    const hr = result?.heart_rate;
    const rr = result?.resp_rate;
    const cry = result?.cry_intensity;
    const risk = result?.risk_level || "LOW";

    useEffect(() => {
        // Animate from 0 to score
        const timer = setTimeout(() => {
            setDisplayedScore(score);
        }, 300);
        return () => clearTimeout(timer);
    }, [score]);

    const hue = Math.max(0, 120 - displayedScore * 12);
    const color = `hsl(${hue}, 100%, 45%)`;

    return (
        <div className="pain-meter zoom-in multimodal-meter">
            <div className="core-score">
                <div className={`risk-badge risk-${risk.toLowerCase()}`}>{risk} RISK</div>

                <div className="score-circle" style={{ borderColor: color, color: color, boxShadow: `0 0 20px ${color}44` }}>
                    <span className="emoji">{EMOJIS[displayedScore] || '❓'}</span>
                    <span className="number">{displayedScore} / 10</span>
                </div>

                <div className="gauge-bar">
                    <div
                        className="gauge-fill"
                        style={{ width: `${(displayedScore / 10) * 100}%`, backgroundColor: color }}
                    />
                </div>

                <p className="description">
                    {displayedScore <= 3 && "Mild Pain"}
                    {displayedScore > 3 && displayedScore <= 6 && "Moderate Pain"}
                    {displayedScore > 6 && "Severe Pain"}
                </p>
            </div>

            {(hr || rr || cry) && (
                <div className="physio-overlay slide-up">
                    <h4>Physiological Vitals</h4>
                    <div className="vitals-grid">
                        {hr && <div className="vital"><span className="label">Heart Rate (rPPG)</span><span className="val">{hr} bpm</span></div>}
                        {rr && <div className="vital"><span className="label">Respiration</span><span className="val">{rr} bpm</span></div>}
                        {cry && <div className="vital"><span className="label">Cry Intensity</span><span className="val pulse-red">{Math.round(cry * 100)}%</span></div>}
                    </div>
                </div>
            )}
        </div>
    );
}
