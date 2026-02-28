import React from 'react';

export default function ScanPrompt({ onStart, patientId }) {
    return (
        <div className="scan-prompt slide-up">
            <div className="icon-wrapper">
                <span role="img" aria-label="camera" className="camera-emoji">📷</span>
            </div>
            <h2>PainScan Setup</h2>
            <p>Point the camera at your child's face in a well-lit area.</p>
            <div className="instructions">
                <ul>
                    <li>Ensure their face is clearly visible.</li>
                    <li>Keep the device steady for 10 seconds.</li>
                    <li>Make sure they are relaxed if possible.</li>
                </ul>
            </div>
            <button className="primary-btn pulse-btn" onClick={onStart}>
                Start Scan
            </button>
        </div>
    );
}
