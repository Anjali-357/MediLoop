import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8000';

const MODULE_COLORS = {
    onboarding: { color: '#818cf8', icon: '👋' },
    recoverbot: { color: '#34d399', icon: '📋' },
    painscan: { color: '#f87171', icon: '🩹' },
    caregap: { color: '#fbbf24', icon: '🔎' },
    orchestrator: { color: '#a78bfa', icon: '🧠' },
    manual: { color: '#64748b', icon: '✉️' },
    returning: { color: '#22d3ee', icon: '🔄' },
    chatbot: { color: '#94a3b8', icon: '💬' },
    emergency: { color: '#ef4444', icon: '🚨' },
};

function SessionCard({ s }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = MODULE_COLORS[s.active_module] || MODULE_COLORS.manual;
    const msgs = s.messages || [];

    return (
        <div style={{
            background: '#0f172a', border: '1px solid #1e293b',
            borderLeft: `3px solid ${cfg.color}`,
            borderRadius: 10, padding: '12px 16px', marginBottom: 10,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.1rem' }}>{cfg.icon}</span>
                    <div>
                        <span style={{ color: cfg.color, fontWeight: 700, fontSize: '0.85rem' }}>
                            {s.active_module}
                        </span>
                        <span style={{ color: '#334155', fontSize: '0.72rem', marginLeft: 8 }}>
                            via {s.channel}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ color: '#475569', fontSize: '0.72rem' }}>
                        {s.last_message_ts ? new Date(s.last_message_ts).toLocaleString() : '—'}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        ...{(s.patient_id || '').slice(-6)}
                    </span>
                    <button
                        onClick={() => setExpanded(p => !p)}
                        style={{ background: '#1e293b', border: 'none', borderRadius: 6, color: '#94a3b8', padding: '3px 10px', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                        {expanded ? '▲' : `${msgs.length} msgs ▼`}
                    </button>
                </div>
            </div>

            {expanded && (
                <div style={{ marginTop: 12, borderTop: '1px solid #1e293b', paddingTop: 10 }}>
                    {msgs.length === 0 && <p style={{ color: '#334155', fontSize: '0.8rem' }}>No messages</p>}
                    {msgs.slice().reverse().map((m, i) => (
                        <div key={i} style={{
                            background: '#020617', borderRadius: 8, padding: '8px 12px', marginBottom: 6,
                            borderLeft: `2px solid ${m.direction === 'outbound' ? '#4f46e5' : '#334155'}`,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ color: m.direction === 'outbound' ? '#818cf8' : '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>
                                    {m.direction === 'outbound' ? '⬆ MediLoop' : '⬇ Patient'} · {m.module}
                                </span>
                                <span style={{ color: '#334155', fontSize: '0.68rem' }}>
                                    {m.ts ? new Date(m.ts).toLocaleTimeString() : ''}
                                </span>
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                                {m.body}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CommHubDashboard() {
    const [sessions, setSessions] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');

    // Initiate form
    const [initPatient, setInitPatient] = useState('');
    const [initReturn, setInitReturn] = useState(false);
    const [initiating, setInitiating] = useState(false);

    // Send form
    const [sendPatient, setSendPatient] = useState('');
    const [sendMsg, setSendMsg] = useState('');
    const [sending, setSending] = useState(false);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/api/commhub/sessions`).then(x => x.json());
            if (r.success) setSessions(r.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchPatients = async () => {
        try {
            const r = await fetch(`${API}/api/commhub/patients`).then(x => x.json());
            if (r.success) setPatients(r.data || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchSessions(); fetchPatients(); }, []);

    const handleInitiate = async () => {
        if (!initPatient) return;
        setInitiating(true);
        try {
            const r = await fetch(`${API}/api/commhub/initiate/${initPatient}?returning=${initReturn}`, {
                method: 'POST'
            }).then(x => x.json());
            showToast(r.success ? `✅ ${r.message}` : `❌ ${r.message || 'Failed'}`);
            if (r.success) fetchSessions();
        } catch { showToast('Error initiating conversation'); }
        setInitiating(false);
    };

    const handleSend = async () => {
        if (!sendPatient || !sendMsg.trim()) return;
        setSending(true);
        try {
            const r = await fetch(`${API}/api/commhub/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_id: sendPatient, message: sendMsg, module: 'manual' }),
            }).then(x => x.json());
            showToast(r.success ? '✅ Message sent!' : '❌ Failed to send');
            if (r.success) { setSendMsg(''); fetchSessions(); }
        } catch { showToast('Error sending message'); }
        setSending(false);
    };

    return (
        <div style={{ minHeight: '100vh', background: '#020617', fontFamily: "'Inter', sans-serif", color: '#e2e8f0', padding: 32 }}>

            <div style={{ marginBottom: 28 }}>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>📲 CommHub</h1>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                    WhatsApp Automation & Conversation Gateway — all modules route through here
                </p>
            </div>

            {toast && (
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 18px', marginBottom: 20, fontSize: '0.85rem' }}>
                    {toast}
                </div>
            )}

            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                {[
                    { label: 'Active Sessions', value: sessions.length, color: '#818cf8' },
                    { label: 'Messages Sent', value: sessions.reduce((a, s) => a + (s.messages?.length || 0), 0), color: '#34d399' },
                ].map(s => (
                    <div key={s.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '14px 24px', minWidth: 140 }}>
                        <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</p>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem' }}>{s.label}</p>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Left: Action panels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Initiate Conversation */}
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>👋 Initiate Conversation</h2>
                        <p style={{ color: '#475569', fontSize: '0.8rem', marginBottom: 14 }}>
                            Send the onboarding WhatsApp message to a patient instantly.
                        </p>

                        <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: 4 }}>Patient</label>
                        <select
                            value={initPatient}
                            onChange={e => setInitPatient(e.target.value)}
                            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', marginBottom: 12, fontSize: '0.85rem', boxSizing: 'border-box' }}
                        >
                            <option value="">— Select patient —</option>
                            {patients.map(p => (
                                <option key={p._id} value={p._id}>{p.name}</option>
                            ))}
                        </select>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: '0.8rem', marginBottom: 14, cursor: 'pointer' }}>
                            <input type="checkbox" checked={initReturn} onChange={e => setInitReturn(e.target.checked)}
                                style={{ width: 16, height: 16 }} />
                            Returning patient (send re-engagement message)
                        </label>

                        <button
                            onClick={handleInitiate}
                            disabled={initiating || !initPatient}
                            style={{ width: '100%', padding: 10, background: '#4f46e5', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                        >
                            {initiating ? '📤 Sending...' : '📤 Send Welcome Message'}
                        </button>
                    </div>

                    {/* Manual Send */}
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>✉️ Manual Send</h2>
                        <p style={{ color: '#475569', fontSize: '0.8rem', marginBottom: 14 }}>
                            Doctor sends a custom WhatsApp to any patient directly.
                        </p>

                        <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: 4 }}>Patient</label>
                        <select
                            value={sendPatient}
                            onChange={e => setSendPatient(e.target.value)}
                            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', marginBottom: 12, fontSize: '0.85rem', boxSizing: 'border-box' }}
                        >
                            <option value="">— Select patient —</option>
                            {patients.map(p => (
                                <option key={p._id} value={p._id}>{p.name}</option>
                            ))}
                        </select>

                        <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: 4 }}>Message</label>
                        <textarea
                            rows={4}
                            placeholder="Type your message..."
                            value={sendMsg}
                            onChange={e => setSendMsg(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: '0.85rem', resize: 'vertical', marginBottom: 12 }}
                        />

                        <button
                            onClick={handleSend}
                            disabled={sending || !sendPatient || !sendMsg.trim()}
                            style={{ width: '100%', padding: 10, background: '#0284c7', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                        >
                            {sending ? '📤 Sending...' : '📤 Send Message'}
                        </button>
                    </div>

                    {/* How CommHub works */}
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                        <h2 style={{ marginTop: 0, fontSize: '0.95rem', color: '#64748b' }}>🔁 Event → Message Flow</h2>
                        <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.8 }}>
                            {[
                                ['patient.created', 'Welcome onboarding message'],
                                ['patient.returning', 'Re-engagement message'],
                                ['followup.flagged', 'Risk alert to patient'],
                                ['painscan.requested', 'PainScan link sent'],
                                ['recoverbot.requested', 'Recovery check-in prompt'],
                                ['caregap.scan_requested', 'Care reminder sent'],
                            ].map(([evt, action]) => (
                                <div key={evt} style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                                    <code style={{ color: '#818cf8', minWidth: 200 }}>{evt}</code>
                                    <span>→ {action}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Session log */}
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ margin: 0, fontSize: '1rem' }}>📋 Message Sessions</h2>
                        <button
                            onClick={fetchSessions}
                            style={{ padding: '6px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}
                        >
                            🔄 Refresh
                        </button>
                    </div>

                    <div style={{ maxHeight: 680, overflowY: 'auto' }}>
                        {loading && <p style={{ color: '#475569' }}>Loading...</p>}
                        {!loading && sessions.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155' }}>
                                <p style={{ fontSize: '2rem' }}>📲</p>
                                <p style={{ fontSize: '0.85rem' }}>No sessions yet. Initiate a conversation above!</p>
                            </div>
                        )}
                        {sessions.map(s => <SessionCard key={s._id} s={s} />)}
                    </div>
                </div>
            </div>

            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');`}</style>
        </div>
    );
}
