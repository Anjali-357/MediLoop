import React, { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:8000';

const INTENT_CONFIG = {
    PAIN: { color: '#ef4444', bg: '#450a0a', icon: '🩹', module: 'PainScan' },
    FOLLOWUP: { color: '#f97316', bg: '#431407', icon: '📋', module: 'RecoverBot' },
    CARE_GAP: { color: '#f59e0b', bg: '#422006', icon: '🔎', module: 'CareGap' },
    GENERAL_QUERY: { color: '#3b82f6', bg: '#172554', icon: '💬', module: 'Chatbot' },
    EMERGENCY: { color: '#dc2626', bg: '#450a0a', icon: '🚨', module: 'Emergency' },
};

function ConfidenceBar({ value }) {
    const pct = Math.round((value || 0) * 100);
    const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: '#0F172A', borderRadius: 3 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
            <span style={{ color, fontSize: '0.75rem', fontWeight: 700, minWidth: 36 }}>{pct}%</span>
        </div>
    );
}

function DecisionCard({ d }) {
    const cfg = INTENT_CONFIG[d.intent] || INTENT_CONFIG.GENERAL_QUERY;
    return (
        <div style={{
            background: cfg.bg,
            border: `1px solid ${cfg.color}33`,
            borderLeft: `3px solid ${cfg.color}`,
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 10,
            animation: 'slideIn 0.3s ease',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.1rem' }}>{cfg.icon}</span>
                    <span style={{ color: cfg.color, fontWeight: 700, fontSize: '0.85rem' }}>{d.intent}</span>
                    <span style={{ color: '#0F172A', fontSize: '0.72rem' }}>→</span>
                    <span style={{ color: '#64748B', fontSize: '0.78rem' }}>{cfg.module}</span>
                </div>
                <span style={{ color: '#64748B', fontSize: '0.68rem' }}>
                    {new Date(d.created_at).toLocaleTimeString()}
                </span>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.78rem', margin: '0 0 6px', fontStyle: 'italic' }}>
                "{d.reasoning}"
            </p>
            <ConfidenceBar value={d.confidence} />
            <p style={{ color: '#0F172A', fontSize: '0.68rem', margin: '6px 0 0' }}>
                Patient: <span style={{ color: '#64748b', fontFamily: 'monospace' }}>...{(d.patient_id || '').slice(-6)}</span>
                {' · '}Source: <span style={{ color: '#64748b' }}>{d.trigger_source}</span>
            </p>
        </div>
    );
}

export default function OrchestratorDashboard() {
    const [decisions, setDecisions] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState('');
    const [analyzing, setAnalyzing] = useState(false);

    // Analyze form
    const [selectedPatient, setSelectedPatient] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [lastResult, setLastResult] = useState(null);

    // Manual trigger form
    const [triggerPatient, setTriggerPatient] = useState('');
    const [triggerModule, setTriggerModule] = useState('painscan');

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    const fetchDecisions = async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/api/orchestrator/recent?limit=30`).then(x => x.json());
            if (r.success) setDecisions(r.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchPatients = async () => {
        try {
            const r = await fetch(`${API}/api/commhub/patients`).then(x => x.json());
            if (r.success) setPatients(r.data || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchDecisions(); fetchPatients(); }, []);

    const handleAnalyze = async () => {
        if (!selectedPatient || !testMessage.trim()) return;
        setAnalyzing(true);
        try {
            const r = await fetch(`${API}/api/orchestrator/analyze-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_id: selectedPatient, message: testMessage, trigger_source: 'dashboard_test' }),
            }).then(x => x.json());
            if (r.success) {
                setLastResult(r.data);
                showToast(`✅ Intent: ${r.data.intent} → ${r.data.suggested_module}`);
                fetchDecisions();
                setTestMessage('');
            }
        } catch (e) { showToast('Error analyzing message'); }
        setAnalyzing(false);
    };

    const handleManualTrigger = async () => {
        if (!triggerPatient) return;
        try {
            const r = await fetch(`${API}/api/orchestrator/manual-trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_id: triggerPatient, module: triggerModule, reason: 'Manual doctor trigger from dashboard' }),
            }).then(x => x.json());
            if (r.success) {
                showToast(`✅ ${r.data.module_triggered} triggered!`);
                fetchDecisions();
            }
        } catch (e) { showToast('Error triggering module'); }
    };

    const intentCounts = decisions.reduce((acc, d) => {
        acc[d.intent] = (acc[d.intent] || 0) + 1;
        return acc;
    }, {});

    return (
        <div style={{ minHeight: '100vh', background: '#020617', fontFamily: "'Inter', sans-serif", color: '#0F172A', padding: 32 }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>🧠 AI Orchestrator</h1>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                    Intent Router & Care Orchestration Engine — the global brain of MediLoop
                </p>
            </div>

            {toast && (
                <div style={{ background: '#FFFFFF', border: '1px solid #0F172A', borderRadius: 8, padding: '10px 18px', marginBottom: 20, fontSize: '0.85rem' }}>
                    {toast}
                </div>
            )}

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
                {Object.entries(INTENT_CONFIG).map(([intent, cfg]) => (
                    <div key={intent} style={{ background: cfg.bg, border: `1px solid ${cfg.color}44`, borderRadius: 10, padding: '10px 16px', minWidth: 110 }}>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: cfg.color }}>{intentCounts[intent] || 0}</p>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.7rem' }}>{cfg.icon} {intent.replace('_', ' ')}</p>
                    </div>
                ))}
                <div style={{ background: '#FFFFFF', border: '1px solid #0F172A', borderRadius: 10, padding: '10px 16px', minWidth: 110 }}>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#818cf8' }}>{decisions.length}</p>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.7rem' }}>📊 Total Decisions</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Left column: Analyze + Manual Trigger */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Analyze Message Panel */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #0F172A', borderRadius: 12, padding: 20 }}>
                        <h2 style={{ marginTop: 0, fontSize: '1rem', color: '#0F172A' }}>🔍 Test Intent Classifier</h2>
                        <p style={{ color: '#64748B', fontSize: '0.8rem', marginBottom: 14 }}>
                            Simulate a patient WhatsApp message and see how Gemini classifies + routes it.
                        </p>

                        <label style={{ color: '#64748B', fontSize: '0.78rem', display: 'block', marginBottom: 4 }}>Patient</label>
                        <select
                            value={selectedPatient}
                            onChange={e => setSelectedPatient(e.target.value)}
                            style={{ width: '100%', background: '#0F172A', border: '1px solid #0F172A', borderRadius: 8, color: '#0F172A', padding: '8px 12px', marginBottom: 12, fontSize: '0.85rem', boxSizing: 'border-box' }}
                        >
                            <option value="">— Select patient —</option>
                            {patients.map(p => (
                                <option key={p._id} value={p._id}>{p.name}</option>
                            ))}
                        </select>

                        <label style={{ color: '#64748B', fontSize: '0.78rem', display: 'block', marginBottom: 4 }}>Patient message</label>
                        <textarea
                            rows={3}
                            placeholder="e.g. 'My knee is in severe pain and I can't walk'"
                            value={testMessage}
                            onChange={e => setTestMessage(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', background: '#0F172A', border: '1px solid #0F172A', borderRadius: 8, color: '#0F172A', padding: '8px 12px', fontSize: '0.85rem', resize: 'vertical', marginBottom: 12 }}
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing || !selectedPatient || !testMessage.trim()}
                            style={{ width: '100%', padding: '10px', background: '#10B981', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                        >
                            {analyzing ? '🔄 Analyzing...' : '⚡ Analyze & Route'}
                        </button>

                        {lastResult && (
                            <div style={{ marginTop: 16, background: '#020617', border: `1px solid ${INTENT_CONFIG[lastResult.intent]?.color || '#0F172A'}`, borderRadius: 10, padding: 14 }}>
                                <p style={{ margin: '0 0 4px', color: INTENT_CONFIG[lastResult.intent]?.color, fontWeight: 700 }}>
                                    {INTENT_CONFIG[lastResult.intent]?.icon} {lastResult.intent} → {lastResult.suggested_module}
                                </p>
                                <p style={{ margin: '0 0 8px', color: '#64748B', fontSize: '0.8rem', fontStyle: 'italic' }}>"{lastResult.reasoning}"</p>
                                <ConfidenceBar value={lastResult.confidence} />
                                <p style={{ margin: '8px 0 0', color: '#64748B', fontSize: '0.75rem' }}>Action: {lastResult.action_taken}</p>
                            </div>
                        )}
                    </div>

                    {/* Manual Trigger Panel */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #0F172A', borderRadius: 12, padding: 20 }}>
                        <h2 style={{ marginTop: 0, fontSize: '1rem', color: '#0F172A' }}>🎛️ Manual Module Trigger</h2>
                        <p style={{ color: '#64748B', fontSize: '0.8rem', marginBottom: 14 }}>
                            Doctor overrides — force activate any module for any patient.
                        </p>
                        <label style={{ color: '#64748B', fontSize: '0.78rem', display: 'block', marginBottom: 4 }}>Patient</label>
                        <select
                            value={triggerPatient}
                            onChange={e => setTriggerPatient(e.target.value)}
                            style={{ width: '100%', background: '#0F172A', border: '1px solid #0F172A', borderRadius: 8, color: '#0F172A', padding: '8px 12px', marginBottom: 12, fontSize: '0.85rem', boxSizing: 'border-box' }}
                        >
                            <option value="">— Select patient —</option>
                            {patients.map(p => (
                                <option key={p._id} value={p._id}>{p.name}</option>
                            ))}
                        </select>
                        <label style={{ color: '#64748B', fontSize: '0.78rem', display: 'block', marginBottom: 4 }}>Module to trigger</label>
                        <select
                            value={triggerModule}
                            onChange={e => setTriggerModule(e.target.value)}
                            style={{ width: '100%', background: '#0F172A', border: '1px solid #0F172A', borderRadius: 8, color: '#0F172A', padding: '8px 12px', marginBottom: 12, fontSize: '0.85rem', boxSizing: 'border-box' }}
                        >
                            <option value="painscan">🩹 PainScan</option>
                            <option value="recoverbot">📋 RecoverBot</option>
                            <option value="caregap">🔎 CareGap Scan</option>
                            <option value="chatbot">💬 Chatbot Reply</option>
                            <option value="emergency">🚨 Emergency Alert</option>
                        </select>
                        <button
                            onClick={handleManualTrigger}
                            disabled={!triggerPatient}
                            style={{ width: '100%', padding: '10px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                        >
                            🚀 Force Trigger
                        </button>
                    </div>
                </div>

                {/* Right column: Decision feed */}
                <div style={{ background: '#FFFFFF', border: '1px solid #0F172A', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ margin: 0, fontSize: '1rem', color: '#0F172A' }}>📡 Live Decision Feed</h2>
                        <button
                            onClick={fetchDecisions}
                            style={{ padding: '6px 14px', background: '#0F172A', border: '1px solid #0F172A', borderRadius: 8, color: '#64748B', cursor: 'pointer', fontSize: '0.78rem' }}
                        >
                            🔄 Refresh
                        </button>
                    </div>

                    <div style={{ maxHeight: 640, overflowY: 'auto' }}>
                        {loading && <p style={{ color: '#64748B' }}>Loading...</p>}
                        {!loading && decisions.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#0F172A' }}>
                                <p style={{ fontSize: '2rem', margin: 0 }}>🧠</p>
                                <p style={{ fontSize: '0.85rem' }}>No decisions yet. Analyze a message to get started!</p>
                            </div>
                        )}
                        {decisions.map(d => <DecisionCard key={d._id} d={d} />)}
                    </div>
                </div>
            </div>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @keyframes slideIn { from { transform: translateY(-8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
        </div>
    );
}
