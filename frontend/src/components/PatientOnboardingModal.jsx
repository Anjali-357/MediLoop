import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const API = 'http://localhost:8000';

export default function PatientOnboardingModal({ isOpen, onClose }) {
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { setCurrentPatient, setCurrentDoctor } = useContext(AppContext);
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !phone.trim()) {
            setError('Name and Phone are required.');
            return;
        }

        setLoading(true);
        try {
            const normalizedPhone = phone.trim().startsWith('+') ? phone.trim() : `+91${phone.trim()}`;

            // 1. Resolve Patient
            const checkRes = await fetch(`${API}/api/patient/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone, name: name.trim() }),
            });
            const checkData = await checkRes.json();

            if (!checkRes.ok || !checkData.success) {
                throw new Error(checkData.message || 'Failed to resolve patient');
            }

            // We need a Doctor Context for Scribe. Let's just login a mock Doctor
            const loginRes = await fetch(`${API}/api/identity/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: "System Admin", age: 40 }),
            });
            const loginData = await loginRes.json();

            if (loginRes.ok && loginData.success) {
                setCurrentDoctor(loginData.doctor);
            }

            // If existing, parse the patient data returned from the resolver
            if (checkData.data.status === 'existing') {
                setCurrentPatient({
                    _id: checkData.data.patient_id,
                    id: checkData.data.patient_id,
                    name: checkData.data.name,
                    phone: checkData.data.phone,
                    age: checkData.data.age || 30,
                    chronic_conditions: checkData.data.chronic_conditions || []
                });
            } else {
                // If new, use the mock patient created in the resolve step
                setCurrentPatient({
                    _id: checkData.data.patient_id,
                    id: checkData.data.patient_id,
                    name: checkData.data.name,
                    phone: checkData.data.phone,
                    age: 30, // Default mock age
                    chronic_conditions: []
                });

                // Re-resolve with doctor ID now that we have it to link them
                if (loginData.success && loginData.doctor) {
                    await fetch(`${API}/api/patient/resolve`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name.trim(),
                            phone: normalizedPhone,
                            doctor_id: loginData.doctor._id,
                        }),
                    });
                }
            }

            onClose();
            // Redirect to Scribe Context Page
            navigate('/scribe');

        } catch (err) {
            setError(err.message || 'Connection error. Check backend.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
        }}>
            <div style={{
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                borderRadius: '16px',
                padding: '32px',
                width: '100%',
                maxWidth: '400px',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                animation: 'fadeIn 0.2s ease-out forwards',
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: 16, right: 16,
                        background: 'transparent', border: 'none', color: '#94a3b8',
                        cursor: 'pointer', fontSize: '1.2rem', padding: '4px'
                    }}
                >
                    ✕
                </button>

                <h2 style={{
                    margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '700',
                    color: '#f8fafc',
                }}>
                    New Consultation
                </h2>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Patient Name
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Riya Sharma"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px', color: '#f8fafc',
                                outline: 'none', transition: 'border-color 0.2s',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#10b981'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            WhatsApp Number
                        </label>
                        <input
                            type="tel"
                            required
                            placeholder="+91 98765 43210"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px', color: '#f8fafc',
                                outline: 'none', transition: 'border-color 0.2s',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#10b981'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                        />
                    </div>

                    {error && (
                        <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '8px', width: '100%', padding: '14px',
                            background: loading ? 'rgba(16, 185, 129, 0.6)' : '#10b981',
                            color: '#ffffff', border: 'none', borderRadius: '8px',
                            fontWeight: '600', fontSize: '1rem', cursor: loading ? 'wait' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        {loading ? 'Resolving...' : 'Continue →'}
                    </button>
                </form>
            </div>
        </div>
    );
}
