import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const API = 'http://localhost:8000';

export default function Login() {
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [step, setStep] = useState('phone');   // 'phone' | 'details' | 'done'
    const [found, setFound] = useState(null);      // patient from DB or null
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { setCurrentPatient, setCurrentDoctor } = useContext(AppContext);
    const navigate = useNavigate();

    // ── Step 1: Look up patient by phone ──────────────────────────────────────
    const handlePhoneLookup = async (e) => {
        e.preventDefault();
        if (!phone.trim()) { setError('Enter a phone number.'); return; }
        setLoading(true);
        setError('');
        try {
            const normalized = phone.trim().startsWith('+') ? phone.trim() : `+91${phone.trim()}`;
            const res = await fetch(`${API}/api/patient/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalized, name: 'lookup' }),
            });
            const data = await res.json();
            const pt = data.data;
            if (data.success && pt?.status === 'existing') {
                // Known patient — prefill details, skip to confirm
                setFound(pt);
                setName(pt.name || '');
                setAge(pt.age ? String(pt.age) : '');
                setStep('details');
            } else {
                // New patient — ask for name + age
                setFound(null);
                setStep('details');
            }
        } catch {
            setError('Could not reach server. Make sure the backend is running.');
        }
        setLoading(false);
    };

    // ── Step 2: Start session (login + send WhatsApp if new) ──────────────────
    const handleStart = async (e) => {
        e.preventDefault();
        if (!name.trim() || !age) { setError('Name and age are required.'); return; }
        setLoading(true);
        setError('');
        setStep('done');
        try {
            const parsedAge = parseInt(age, 10);
            const normalized = phone.trim().startsWith('+') ? phone.trim() : `+91${phone.trim()}`;

            // Standard identity login
            const loginRes = await fetch(`${API}/api/identity/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), age: parsedAge }),
            });
            const loginData = await loginRes.json();
            if (!loginRes.ok || !loginData.success) throw new Error(loginData.message || 'Login failed');

            setCurrentDoctor(loginData.doctor);
            setCurrentPatient(loginData.patient);
            const patientId = loginData.patient._id || loginData.patient.id;

            // Resolve / upsert phone
            await fetch(`${API}/api/patient/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    phone: normalized,
                    doctor_id: loginData.doctor?._id || '',
                }),
            });

            // WhatsApp welcome is now handled natively by the backend event listener
            // listening for the `patient.created` and `patient.returning` events published
            // by `/api/patient/resolve` above. No need to explicitly initiate here!

            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Error starting session');
            setStep('details');
        }
        setLoading(false);
    };

    // ── Styles ────────────────────────────────────────────────────────────────
    const wrap = {
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
        fontFamily: "'Inter', sans-serif",
    };
    const card = {
        background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16,
        padding: '40px 36px', width: '100%', maxWidth: 420,
        boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
    };
    const inp = {
        width: '100%', boxSizing: 'border-box',
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 8, color: '#e2e8f0', padding: '10px 14px',
        fontSize: '0.88rem', outline: 'none', marginBottom: 14,
    };
    const lbl = { display: 'block', color: '#94a3b8', fontSize: '0.73rem', fontWeight: 600, marginBottom: 5 };
    const btn = (active) => ({
        width: '100%', padding: '12px 0', border: 'none', borderRadius: 10,
        background: active ? '#4f46e5' : '#1e293b',
        color: active ? '#fff' : '#475569',
        fontWeight: 700, fontSize: '0.92rem',
        cursor: active ? 'pointer' : 'default', transition: 'all 0.2s',
    });

    return (
        <div style={wrap}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
            <div style={card}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontSize: '2.4rem' }}>🏥</div>
                    <h1 style={{ margin: '6px 0 4px', color: '#818cf8', fontSize: '1.5rem', fontWeight: 800 }}>MediLoop</h1>
                    <p style={{ margin: 0, color: '#475569', fontSize: '0.82rem' }}>
                        {step === 'phone' ? 'Enter patient WhatsApp number to begin' : found
                            ? `Found: ${found.name} — confirm to start session`
                            : 'New patient — enter details to register'}
                    </p>
                </div>

                {/* Step 1: Phone lookup */}
                {step === 'phone' && (
                    <form onSubmit={handlePhoneLookup}>
                        <label style={lbl}>PATIENT WHATSAPP NUMBER</label>
                        <input
                            type="tel" autoFocus required
                            placeholder="+91 98765 43210"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            style={inp}
                        />
                        {error && <ErrBox msg={error} />}
                        <button type="submit" disabled={loading} style={btn(!loading)}>
                            {loading ? '🔍 Searching...' : '🔍 Look up Patient'}
                        </button>
                    </form>
                )}

                {/* Step 2: Confirm / Fill details */}
                {step === 'details' && (
                    <form onSubmit={handleStart}>
                        {/* Phone read-only */}
                        <label style={lbl}>WHATSAPP NUMBER</label>
                        <div style={{ ...inp, color: '#475569', marginBottom: 14, cursor: 'default' }}>
                            {phone}
                            <span
                                onClick={() => { setStep('phone'); setFound(null); setName(''); setAge(''); }}
                                style={{ float: 'right', color: '#4f46e5', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                                change
                            </span>
                        </div>

                        {/* Patient badge if found */}
                        {found && (
                            <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem', color: '#4ade80' }}>
                                ✅ Returning patient — session will resume their history
                            </div>
                        )}

                        <label style={lbl}>PATIENT NAME</label>
                        <input
                            type="text" required autoFocus
                            placeholder="e.g. Riya Sharma"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            style={inp}
                        />

                        <label style={lbl}>AGE</label>
                        <input
                            type="number" required min="0" max="120"
                            placeholder="e.g. 34"
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            style={{ ...inp, marginBottom: 22 }}
                        />

                        {error && <ErrBox msg={error} />}
                        <button type="submit" disabled={loading} style={btn(!loading)}>
                            {loading ? '⏳ Starting...' : found ? '🚀 Resume Session' : '🚀 Create Patient & Start'}
                        </button>
                    </form>
                )}

                {/* Step done: spinner while navigating */}
                {step === 'done' && (
                    <div style={{ textAlign: 'center', color: '#818cf8', padding: '20px 0' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>
                        Starting session...
                    </div>
                )}
            </div>
        </div>
    );
}

function ErrBox({ msg }) {
    return (
        <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: 8, padding: '9px 14px', color: '#f87171', fontSize: '0.8rem', marginBottom: 14 }}>
            {msg}
        </div>
    );
}
