import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:8000';

export default function ControlCenter() {
    const [gaps, setGaps] = useState([]);
    const [followups, setFollowups] = useState([]);
    const [patients, setPatients] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [unmappedMessages, setUnmappedMessages] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [sendMsg, setSendMsg] = useState({ patientId: '', text: '' });
    const [sending, setSending] = useState(false);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [gRes, fRes, pRes, aRes, uRes] = await Promise.all([
                fetch(`${API}/api/caregap/pending`).then(r => r.json()),
                fetch(`${API}/api/recoverbot/followups`).then(r => r.json()).catch(() => ({ data: [] })),
                fetch(`${API}/api/commhub/patients`).then(r => r.json()),
                fetch(`${API}/api/commhub/appointments`).then(r => r.json()).catch(() => ({ data: [] })),
                fetch(`${API}/api/commhub/unmapped`).then(r => r.json()).catch(() => ({ data: [] })),
            ]);
            setGaps(gRes.data || []);
            setFollowups((fRes.data || []).filter(f => ['HIGH', 'CRITICAL'].includes(f.risk_label)));
            setPatients(pRes.data || []);
            setAppointments(aRes.data || []);
            setUnmappedMessages(uRes.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const toggleGap = (id) => setSelected(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });
    const selectAll = () => setSelected(new Set(gaps.map(g => g._id)));
    const clearAll = () => setSelected(new Set());

    const bulkApprove = async (sendMessages) => {
        if (!selected.size) return;
        try {
            const r = await fetch(`${API}/api/caregap/approve-bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gap_ids: [...selected], send_messages: sendMessages }),
            }).then(x => x.json());
            showToast(r.success ? `✅ ${r.message}` : `❌ ${r.message || 'Failed'}`);
            if (r.success) { setSelected(new Set()); fetchAll(); }
        } catch { showToast('❌ Error approving gaps'); }
    };

    const dismissAppt = async (id) => {
        try {
            await fetch(`${API}/api/commhub/appointments/${id}/dismiss`, { method: 'PATCH' });
            setAppointments(prev => prev.filter(a => a._id !== id));
            showToast('✅ Appointment request dismissed');
        } catch { showToast('❌ Failed to dismiss'); }
    };

    const confirmAppt = async (appt) => {
        // Send a WhatsApp confirmation to patient
        try {
            await fetch(`${API}/api/commhub/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: appt.patient_id,
                    message: `Hi ${appt.patient_name}, your appointment request has been confirmed. Your doctor's team will reach out with the exact time. See you soon! 🗓️`,
                    module: 'appointment_confirm',
                }),
            });
            await fetch(`${API}/api/commhub/appointments/${appt._id}/dismiss`, { method: 'PATCH' });
            setAppointments(prev => prev.filter(a => a._id !== appt._id));
            showToast(`✅ Confirmation sent to ${appt.patient_name}`);
        } catch { showToast('❌ Failed to confirm'); }
    };

    const resolveUnmapped = async (msg) => {
        try {
            await fetch(`${API}/api/commhub/unmapped/${msg._id}/resolve`, { method: 'PATCH' });
            setUnmappedMessages(prev => prev.filter(m => m._id !== msg._id));
            showToast(`✅ Resolved message from ${msg.patient_name}`);
        } catch { showToast('❌ Failed to resolve'); }
    };

    const replyUnmapped = async (msg) => {
        const replyText = prompt('Enter reply to patient:');
        if (!replyText) return;
        try {
            await fetch(`${API}/api/commhub/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_id: msg.patient_id,
                    message: replyText,
                    module: 'doctor_manual',
                }),
            });
            await fetch(`${API}/api/commhub/unmapped/${msg._id}/resolve`, { method: 'PATCH' });
            setUnmappedMessages(prev => prev.filter(m => m._id !== msg._id));
            showToast(`✅ Replied to ${msg.patient_name}`);
        } catch { showToast('❌ Failed to reply'); }
    };

    const sendManual = async () => {
        if (!sendMsg.patientId || !sendMsg.text.trim()) return;
        setSending(true);
        try {
            const r = await fetch(`${API}/api/commhub/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_id: sendMsg.patientId, message: sendMsg.text, module: 'doctor_manual' }),
            }).then(x => x.json());
            showToast(r.success ? '✅ Message sent' : '❌ Failed');
            if (r.success) setSendMsg({ patientId: '', text: '' });
        } catch { showToast('❌ Error sending'); }
        setSending(false);
    };

    const RISK_COLOR = { HIGH: '#f87171', CRITICAL: '#c084fc', MEDIUM: '#fbbf24', LOW: '#4ade80' };
    const totalActions = gaps.length + followups.length + appointments.length + unmappedMessages.length;

    return (
        <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', sans-serif", color: '#0F172A', padding: 28 }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>
                        ⚡ Control Center
                        {totalActions > 0 && (
                            <span style={{ marginLeft: 12, background: '#f87171', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                                {totalActions} pending
                            </span>
                        )}
                    </h1>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.8rem' }}>
                        Human-in-loop actions — your required interventions only
                    </p>
                </div>
                <button onClick={fetchAll} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, color: '#64748B', padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem' }}>
                    🔄 Refresh All
                </button>
            </div>

            {toast && (
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: '0.85rem' }}>
                    {toast}
                </div>
            )}

            {/* TOP ROW: Appointment Requests + Unmapped Messages + Flagged Patients */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>

                {/* Appointment Requests */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: '0.95rem' }}>
                        🗓️ Appointment Requests
                        <span style={{ marginLeft: 8, color: appointments.length > 0 ? '#818cf8' : '#0F172A', fontWeight: 800 }}>
                            ({appointments.length})
                        </span>
                    </h2>
                    {loading && <p style={{ color: '#64748B', fontSize: '0.8rem' }}>Loading...</p>}
                    {!loading && appointments.length === 0 && (
                        <p style={{ color: '#0F172A', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                            ✅ No pending appointment requests
                        </p>
                    )}
                    {appointments.map(a => (
                        <div key={a._id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px', marginBottom: 10, borderLeft: '3px solid #818cf8' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{a.patient_name}</span>
                                    <span style={{ color: '#64748B', fontSize: '0.72rem', marginLeft: 8 }}>{a.phone}</span>
                                </div>
                                <span style={{ color: '#0F172A', fontSize: '0.65rem' }}>
                                    {a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                            </div>
                            <p style={{ color: '#64748B', fontSize: '0.78rem', margin: '0 0 10px', fontStyle: 'italic' }}>
                                "{a.message?.slice(0, 100)}"
                            </p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => confirmAppt(a)}
                                    style={{ flex: 1, padding: '6px 0', background: '#10B981', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                                    ✅ Confirm + Notify
                                </button>
                                <button onClick={() => dismissAppt(a._id)}
                                    style={{ padding: '6px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#64748B', fontSize: '0.75rem', cursor: 'pointer' }}>
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Unmapped Messages (Orchestrator Fallback) */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: '0.95rem' }}>
                        🤔 AI Escalations
                        <span style={{ marginLeft: 8, color: unmappedMessages.length > 0 ? '#fbbf24' : '#0F172A', fontWeight: 800 }}>
                            ({unmappedMessages.length})
                        </span>
                    </h2>
                    {loading && <p style={{ color: '#64748B', fontSize: '0.8rem' }}>Loading...</p>}
                    {!loading && unmappedMessages.length === 0 && (
                        <p style={{ color: '#0F172A', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                            ✅ AI handled all recent queries
                        </p>
                    )}
                    {unmappedMessages.map(m => (
                        <div key={m._id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px', marginBottom: 10, borderLeft: '3px solid #fbbf24' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{m.patient_name}</span>
                                    <span style={{ color: '#64748B', fontSize: '0.72rem', marginLeft: 8 }}>{m.phone}</span>
                                </div>
                                <span style={{ color: '#0F172A', fontSize: '0.65rem' }}>
                                    {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <span style={{ padding: '2px 6px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', fontSize: '0.65rem', borderRadius: '4px', fontWeight: 600 }}>
                                    {m.intent}
                                </span>
                                <span style={{ color: '#64748b', fontSize: '0.65rem' }}>
                                    Confidence: {(m.confidence * 100).toFixed(0)}%
                                </span>
                            </div>
                            <p style={{ color: '#64748B', fontSize: '0.78rem', margin: '0 0 10px', fontStyle: 'italic', background: '#FFFFFF', padding: '6px 8px', borderRadius: '4px' }}>
                                "{m.message}"
                            </p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => replyUnmapped(m)}
                                    style={{ flex: 1, padding: '6px 0', background: '#0ea5e9', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                                    💬 Reply Now
                                </button>
                                <button onClick={() => resolveUnmapped(m)}
                                    style={{ padding: '6px 12px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#64748B', fontSize: '0.75rem', cursor: 'pointer' }}>
                                    Resolve
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Flagged High-Risk Patients */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: '0.95rem' }}>
                        🚨 Flagged Patients
                        <span style={{ marginLeft: 8, color: followups.length > 0 ? '#f87171' : '#0F172A', fontWeight: 800 }}>
                            ({followups.length})
                        </span>
                    </h2>
                    {loading && <p style={{ color: '#64748B', fontSize: '0.8rem' }}>Loading...</p>}
                    {!loading && followups.length === 0 && (
                        <p style={{ color: '#0F172A', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                            ✅ No high-risk patients right now
                        </p>
                    )}
                    {followups.map(f => (
                        <div key={f._id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', marginBottom: 10, borderLeft: `3px solid ${RISK_COLOR[f.risk_label] || '#f87171'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{f.patient_name}</span>
                                <span style={{ color: RISK_COLOR[f.risk_label] || '#f87171', fontWeight: 700, fontSize: '0.75rem' }}>
                                    {f.risk_label} · {f.risk_score?.toFixed(2)}
                                </span>
                            </div>
                            {f.suggested_action && (
                                <div style={{ marginTop: 6, color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>
                                    ⚠ Suggested: {f.suggested_action}
                                </div>
                            )}
                            {f.suggested_reason && (
                                <p style={{ color: '#64748B', fontSize: '0.72rem', margin: '4px 0 0' }}>{f.suggested_reason}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* BOTTOM ROW: Care Gaps + Manual Send */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Pending Care Gaps */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: '0.95rem' }}>
                        🔎 Pending Care Gaps
                        <span style={{ marginLeft: 8, color: gaps.length > 0 ? '#fbbf24' : '#0F172A', fontWeight: 800 }}>
                            ({gaps.length})
                        </span>
                    </h2>
                    {loading && <p style={{ color: '#64748B', fontSize: '0.8rem' }}>Loading...</p>}
                    {!loading && gaps.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: '#0F172A' }}>
                            <p style={{ fontSize: '1.4rem' }}>✅</p>
                            <p style={{ fontSize: '0.8rem' }}>All patients compliant — no pending gaps!</p>
                        </div>
                    )}
                    {!loading && gaps.length > 0 && (
                        <>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <button onClick={selectAll} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#64748B', padding: '4px 10px', cursor: 'pointer', fontSize: '0.72rem' }}>Select All</button>
                                <button onClick={clearAll} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, color: '#64748B', padding: '4px 10px', cursor: 'pointer', fontSize: '0.72rem' }}>Clear</button>
                            </div>
                            <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 14 }}>
                                {gaps.map(g => (
                                    <div key={g._id} onClick={() => toggleGap(g._id)}
                                        style={{
                                            background: selected.has(g._id) ? '#F1F5F9' : '#F8FAFC',
                                            border: `1px solid ${selected.has(g._id) ? '#10B981' : '#E2E8F0'}`,
                                            borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
                                        }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input type="checkbox" checked={selected.has(g._id)} readOnly style={{ width: 14 }} />
                                            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{g.patient_name || g.patient_id?.slice(-6)}</span>
                                            <span style={{ color: '#fbbf24', fontSize: '0.7rem', marginLeft: 'auto', fontWeight: 600 }}>
                                                {g.gap_type?.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        {g.message && (
                                            <p style={{ color: '#64748B', fontSize: '0.72rem', margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {g.message.slice(0, 80)}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => bulkApprove(true)} disabled={!selected.size}
                                    style={{ flex: 1, padding: '9px 0', background: selected.size ? '#10B981' : '#94A3B8', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                                    ✅ Approve + Send WhatsApp ({selected.size})
                                </button>
                                <button onClick={() => bulkApprove(false)} disabled={!selected.size}
                                    style={{ padding: '9px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, color: '#64748B', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                                    Silent
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Manual WhatsApp */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: '0.95rem' }}>✉️ Direct Message to Patient</h2>
                    <label style={{ color: '#64748B', fontSize: '0.75rem', display: 'block', marginBottom: 5 }}>Patient</label>
                    <select
                        value={sendMsg.patientId}
                        onChange={e => setSendMsg(p => ({ ...p, patientId: e.target.value }))}
                        style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, color: '#0F172A', padding: '8px 12px', marginBottom: 14, fontSize: '0.82rem', boxSizing: 'border-box' }}
                    >
                        <option value="">— Select patient —</option>
                        {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                    <label style={{ color: '#64748B', fontSize: '0.75rem', display: 'block', marginBottom: 5 }}>Message</label>
                    <textarea
                        rows={4}
                        placeholder="Type your message..."
                        value={sendMsg.text}
                        onChange={e => setSendMsg(p => ({ ...p, text: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, color: '#0F172A', padding: '8px 12px', fontSize: '0.82rem', resize: 'vertical', marginBottom: 14 }}
                    />
                    <button
                        onClick={sendManual}
                        disabled={sending || !sendMsg.patientId || !sendMsg.text.trim()}
                        style={{ width: '100%', padding: 10, background: '#0284c7', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                        {sending ? '📤 Sending...' : '📤 Send WhatsApp'}
                    </button>
                </div>
            </div>
        </div>
    );
}
