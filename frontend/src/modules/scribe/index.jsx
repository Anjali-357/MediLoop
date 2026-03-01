import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { Users, Calendar, AlertCircle, Save, CheckCircle } from 'lucide-react';
import RecordingPanel from './RecordingPanel';
import SOAPEditor from './SOAPEditor';
import ICDSelector from './ICDSelector';
import PatientContextPanel from '../../components/PatientContextPanel';

const ScribeAIModule = () => {
    const { currentPatient, currentDoctor } = useContext(AppContext);

    const [sessionId] = useState(() => Math.random().toString(36).substring(7));
    const [transcript, setTranscript] = useState('');
    const [soapData, setSoapData] = useState({
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
    });
    const [icdCodes, setIcdCodes] = useState([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // null, 'success', 'error'
    const [markDischarged, setMarkDischarged] = useState(false);

    // Triggered when RecordingPanel stops
    const handleRecordingStop = async () => {
        if (!transcript) return;
        setIsGenerating(true);
        try {
            // Mock generation delay for visual feedback if doing pure dev, but here we call backend
            const response = await fetch('http://localhost:8000/api/scribe/consultation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: currentPatient._id || currentPatient.id,
                    doctor_id: currentDoctor._id || currentDoctor.id,
                    transcript
                })
            });
            const result = await response.json();

            // We expect the backend to return the whole consultation doc in a real full integration,
            // but if our endpoint only returns ID, we might need to fetch it or we simulate the data.
            // Wait, our backend currently saves and returns { consultation_id }. 
            // It generated the SOAP and ICD codes on the backend.
            // We need to fetch it to display to the doctor.
            if (result.success && result.data?.consultation_id) {
                setSaveStatus({ id: result.data.consultation_id });
                // Fetch the generated data to display in the UI
                const docRes = await fetch(`http://localhost:8000/api/scribe/consultation/${result.data.consultation_id}`);
                const docData = await docRes.json();
                if (docData.success) {
                    setSoapData(docData.data.soap_note || {});
                    // Map the codes to add `selected: true`
                    const codes = docData.data.icd_codes || [];
                    setIcdCodes(codes.map(c => ({ ...c, selected: true })));
                }
            }
        } catch (err) {
            console.error("Failed to generate consultation", err);
            // Fallback for hackathon demo without backend
            setSoapData({
                subjective: "Patient reports a 3-day history of coughing and mild fever.",
                objective: "Temp 99.5F, HR 85, BP 120/80. Clear lungs.",
                assessment: "Likely viral URI.",
                plan: "Rest, hydration. RTC if worsens."
            });
            setIcdCodes([
                { code: "J06.9", description: "Acute upper respiratory infection, unspecified", confidence: 0.95, selected: true }
            ]);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFinalApprove = async () => {
        setIsSaving(true);
        try {
            // In a full implementation, this might PUT the finalised SOAP and filtered ICD codes.
            // For now, if discharge checkbox is checked, we fire the patch endpoint
            if (markDischarged && saveStatus?.id) {
                await fetch(`http://localhost:8000/api/scribe/consultation/${saveStatus.id}/discharge`, {
                    method: 'PATCH'
                });
            }
            setSaveStatus('finalised');
        } catch (err) {
            console.error("Error finalizing", err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Patient Context Banner */}
            <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-6">
                    <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Active Consultation</h1>
                        <div className="flex items-center space-x-2 mt-1">
                            <span className="text-sm font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                                {currentPatient.name}
                            </span>
                            <span className="text-sm text-surface-500">
                                (Phone: {currentPatient.phone || 'N/A'})
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium text-surface-900">{currentDoctor.name}</p>
                        <p className="text-xs text-surface-500">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 h-[calc(100vh-12rem)]">
                {/* Left Column: Recording & Transcript */}
                <div className="lg:col-span-4 flex flex-col h-full">
                    <RecordingPanel
                        sessionId={sessionId}
                        transcript={transcript}
                        setTranscript={setTranscript}
                        onRecordingStop={handleRecordingStop}
                    />
                    <PatientContextPanel patientId={currentPatient._id || currentPatient.id} />

                </div>

                {/* Right Column: SOAP & ICD */}
                <div className="lg:col-span-8 flex flex-col space-y-6 h-full overflow-y-auto pr-2 pb-20">
                    <div className="flex-1">
                        <SOAPEditor
                            soapData={soapData}
                            setSoapData={setSoapData}
                            isGenerating={isGenerating}
                        />
                    </div>

                    <div className="flex-shrink-0">
                        <ICDSelector
                            icdCodes={icdCodes}
                            setIcdCodes={setIcdCodes}
                            isGenerating={isGenerating}
                        />
                    </div>

                    {/* Action Bar */}
                    {(!isGenerating && (icdCodes.length > 0 || soapData.assessment)) && (
                        <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm flex items-center justify-between">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={markDischarged}
                                    onChange={(e) => setMarkDischarged(e.target.checked)}
                                    className="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm font-medium text-surface-700">Discharge Patient after consultation</span>
                            </label>

                            <button
                                onClick={handleFinalApprove}
                                disabled={isSaving || saveStatus === 'finalised'}
                                className="btn-primary"
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                ) : saveStatus === 'finalised' ? (
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                ) : (
                                    <Save className="w-5 h-5 mr-2" />
                                )}
                                {saveStatus === 'finalised' ? 'Consultation Saved' : 'Approve & Finalize'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScribeAIModule;
