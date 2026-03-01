import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import PatientContextPanel from '../../components/PatientContextPanel';

export default function PatientProfile() {
    const { currentPatient } = useContext(AppContext);
    const navigate = useNavigate();

    // If somehow navigated here without a patient, bounce back to dashboard
    useEffect(() => {
        if (!currentPatient) {
            navigate('/dashboard');
        }
    }, [currentPatient, navigate]);

    if (!currentPatient) return null;

    return (
        <div className="h-full flex flex-col space-y-6 lg:p-6 p-4 overflow-y-auto">
            {/* Header / Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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

            {/* Existing Shared Intelligence Panel (takes up the rest of the viewing space) */}
            <div className="flex-1 bg-surface-50 rounded-xl overflow-hidden shadow-sm border border-surface-200" style={{ minHeight: '500px' }}>
                <PatientContextPanel patientId={currentPatient._id || currentPatient.id} />
            </div>
        </div>
    );
}
