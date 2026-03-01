import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import PatientContextPanel from '../../components/PatientContextPanel';

export default function PatientProfile() {
    const { currentPatient } = useContext(AppContext);
    const navigate = useNavigate();

    const [consultations, setConsultations] = useState([]);
    const [loadingConsultations, setLoadingConsultations] = useState(true);
    const [expandedConsultationId, setExpandedConsultationId] = useState(null);

    useEffect(() => {
        if (!currentPatient) {
            navigate('/dashboard');
            return;
        }

        const fetchConsultations = async () => {
            setLoadingConsultations(true);
            try {
                const ptId = currentPatient._id || currentPatient.id;
                const res = await fetch(`http://localhost:8000/api/scribe/consultations?patient_id=${ptId}`);
                const data = await res.json();
                if (data.success) {
                    setConsultations(data.data || []);
                }
            } catch (err) {
                console.error("Failed to fetch consultations", err);
            } finally {
                setLoadingConsultations(false);
            }
        };

        fetchConsultations();
    }, [currentPatient, navigate]);

    if (!currentPatient) return null;

    return (
        <div className="h-full flex flex-col space-y-6 lg:p-6 p-4 overflow-y-auto">
            {/* Header / Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-surface-900 tracking-tight">{currentPatient.name}</h1>
                    <div className="flex items-center space-x-3 mt-2 text-surface-500">
                        <span>Age: {currentPatient.age || 'N/A'}</span>
                        <span>•</span>
                        <span>Phone: {currentPatient.phone || 'N/A'}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/scribe')}
                        className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 transition-colors"
                    >
                        <span className="mr-2">🎙️</span> Start Live Consultation
                    </button>
                    <button
                        onClick={() => navigate('/recoverbot')}
                        className="inline-flex items-center justify-center rounded-lg bg-surface-100 px-6 py-3 text-sm font-semibold text-surface-700 shadow-sm hover:bg-surface-200 transition-colors"
                    >
                        View Bot Follow-ups
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                {/* Left Column: Clinical Notes (Past Consultations) */}
                <div className="w-full lg:w-1/2 flex flex-col space-y-4">
                    <h2 className="text-xl font-semibold text-surface-900 flex items-center gap-2">
                        <span className="w-2 h-6 bg-primary-500 rounded-full"></span>
                        Clinical Notes (ScribeAI)
                    </h2>

                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-surface-200 p-4 overflow-y-auto min-h-[400px]">
                        {loadingConsultations ? (
                            <div className="text-center text-surface-500 py-10">Loading clinical history...</div>
                        ) : consultations.length === 0 ? (
                            <div className="text-center text-surface-500 py-10">No past consultations found using ScribeAI.</div>
                        ) : (
                            <div className="space-y-4">
                                {consultations.map(consult => {
                                    const isExpanded = expandedConsultationId === consult._id;
                                    const date = new Date(consult.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

                                    return (
                                        <div key={consult._id} className="border border-surface-200 rounded-lg overflow-hidden transition-all duration-200">
                                            {/* Note Header / Summary (Click to expand) */}
                                            <div
                                                className={`p-4 cursor-pointer hover:bg-surface-50 flex items-start justify-between ${isExpanded ? 'bg-surface-50 border-b border-surface-200' : 'bg-white'}`}
                                                onClick={() => setExpandedConsultationId(isExpanded ? null : consult._id)}
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-1 flex items-center gap-2">
                                                        <span>{date}</span>
                                                        {consult.status === 'discharged' && (
                                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs">Discharged</span>
                                                        )}
                                                    </div>
                                                    <div className="text-surface-900 font-medium">{consult.summary_short || "Consultation Note"}</div>
                                                </div>
                                                <div className="text-surface-400">
                                                    {isExpanded ? (
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                                    ) : (
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded Content (SOAP + ICD + Transcript) */}
                                            {isExpanded && (
                                                <div className="p-4 bg-white space-y-6">
                                                    {/* SOAP SECTION */}
                                                    {consult.soap_note && (
                                                        <div className="space-y-3">
                                                            <div>
                                                                <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Subjective</h4>
                                                                <p className="text-sm text-surface-800">{consult.soap_note.subjective || "N/A"}</p>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Objective</h4>
                                                                <p className="text-sm text-surface-800">{consult.soap_note.objective || "N/A"}</p>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Assessment</h4>
                                                                <p className="text-sm text-surface-800 font-medium">{consult.soap_note.assessment || "N/A"}</p>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Plan</h4>
                                                                <p className="text-sm text-surface-800">{consult.soap_note.plan || "N/A"}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ICD CODES */}
                                                    {consult.icd_codes && consult.icd_codes.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Detected ICD-10 Codes</h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {consult.icd_codes.map((code, idx) => (
                                                                    <div key={idx} className="bg-surface-100 border border-surface-200 text-surface-700 text-xs px-2 py-1 rounded flex items-center gap-1.5">
                                                                        <span className="font-bold">{code.code}</span>
                                                                        <span className="text-surface-500 truncate max-w-[200px]">{code.description}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* TRANSCRIPT */}
                                                    {consult.transcript && (
                                                        <div className="pt-4 border-t border-surface-100">
                                                            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Raw Transcript</h4>
                                                            <div className="bg-surface-50 p-3 rounded-lg text-sm text-surface-600 italic max-h-40 overflow-y-auto border border-surface-200">
                                                                "{consult.transcript}"
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Existing Shared Intelligence Panel */}
                <div className="w-full lg:w-1/2 flex flex-col space-y-4">
                    <h2 className="text-xl font-semibold text-surface-900 flex items-center gap-2">
                        <span className="w-2 h-6 bg-accentBlue rounded-full" style={{ backgroundColor: '#0EA5E9' }}></span>
                        Active Context
                    </h2>
                    <div className="flex-1 bg-surface-50 rounded-xl overflow-hidden shadow-sm border border-surface-200 min-h-[400px]">
                        <PatientContextPanel patientId={currentPatient._id || currentPatient.id} />
                    </div>
                </div>
            </div>
        </div>
    );
}
