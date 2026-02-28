import React, { useState } from 'react';
import ScanPrompt from './ScanPrompt';
import CameraView from './CameraView';
import PainMeter from './PainMeter';
import PainHistory from './PainHistory';
import './style.css';

export default function PainScanModule() {
  const [step, setStep] = useState('PROMPT'); // PROMPT, SCANNING, RESULT
  const [patientId] = useState('patient_123'); // Mock patient context defaults
  const [followupId] = useState('followup_456');
  const [scanResult, setScanResult] = useState(null);

  const handleStartScan = () => setStep('SCANNING');

  const handleScanComplete = (result) => {
    setScanResult(result);
    setStep('RESULT');
  };

  return (
    <div className="painscan-container">
      {step === 'PROMPT' && <ScanPrompt onStart={handleStartScan} patientId={patientId} />}
      {step === 'SCANNING' && <CameraView onComplete={handleScanComplete} patientId={patientId} followupId={followupId} />}
      {step === 'RESULT' && scanResult && (
        <div className="result-view fade-in">
          <h2>Scan Complete</h2>
          <PainMeter result={scanResult} />
          <PainHistory patientId={patientId} />
          <button className="primary-btn" onClick={() => setStep('PROMPT')}>Done</button>
        </div>
      )}
    </div>
  );
}
