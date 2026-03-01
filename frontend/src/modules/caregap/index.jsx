import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8000';

const GAP_COLORS = {
    DETERIORATION_UNRESOLVED: { bg: '#450a0a', border: '#dc2626', badge: '#ef4444', label: '🔴 Deterioration' },
    FOLLOWUP_MISSING: { bg: '#431407', border: '#ea580c', badge: '#f97316', label: '🟠 Follow-up Missing' },
    LAB_OVERDUE: { bg: '#422006', border: '#d97706', badge: '#f59e0b', label: '🟡 Lab Overdue' },
    VITALS_OVERDUE: { bg: '#172554', border: '#2563eb', badge: '#3b82f6', label: '🔵 Vitals Overdue' },
    SCREENING_OVERDUE: { bg: '#052e16', border: '#16a34a', badge: '#22c55e', label: '🟢 Screening Overdue' },
};

function GapCard({ gap, onApprove, onDismiss }) {
    const [msg, setMsg] = useState(gap.outreach_msg || '');
    const [loading, setLoading] = useState(false);
    const colors = GAP_COLORS[gap.gap_type] || GAP_COLORS['SCREENING_OVERDUE'];

    const approve = async () => {
        setLoading(true);
        await onApprove(gap._id, msg);
        setLoading(false);
    };
    const dismiss = async () => {
        setLoading(true);
        await onDismiss(gap._id);
        setLoading(false);
    };

    return (
        <div style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                    <span style={{
                        background: colors.badge,
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 999,
                    }}>
                        {colors.label}
                    </span>
                    <p style={{ color: '#64748B', fontSize: '0.75rem', marginTop: 6 }}>
                        Patient: <span style={{ color: '#0F172A', fontFamily: 'monospace' }}>{gap.patient_id?.slice(-8)}</span>
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 2 }}>
                        Flagged: {new Date(gap.flagged_at).toLocaleString()}
                    </p>
                </div>
                <span style={{ color: '#64748B', fontSize: '0.72rem', fontWeight: 600 }}>P{gap.priority}</span>
            </div>

            <label style={{ color: '#64748B', fontSize: '0.78rem', display: 'block', marginBottom: 4 }}>
                📱 Draft WhatsApp Message (editable)
            </label>
            <textarea
                rows={3}
                value={msg}
                onChange={e => setMsg(e.target.value)}
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    color: '#0F172A',
                    fontSize: '0.82rem',
                    padding: '8px 10px',
                    resize: 'vertical',
                    lineHeight: 1.5,
                }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                <button
                    onClick={dismiss}
                    disabled={loading}
                    style={{
                        padding: '7px 14px',
                        background: 'transparent',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        color: '#64748B',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                    }}
                >
                    ✕ Dismiss
                </button>
                <button
                    onClick={approve}
                    disabled={loading}
                    style={{
                        padding: '7px 16px',
                        background: '#10B981',
                        border: 'none',
                        borderRadius: 8,
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                    }}
                >
                    {loading ? '...' : '✉️ Approve & Send'}
                </button>
            </div>
        </div>
    );
}

function Analytics({ stats }) {
    const entries = Object.entries(stats || {});
    if (!entries.length) return null;
    return (
        <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
        }}>
            <h3 style={{ color: '#0F172A', marginBottom: 14, fontSize: '1rem' }}>📊 Analytics</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {entries.map(([type, counts]) => (
                    <div key={type} style={{
                        background: '#FFFFFF',
                        borderRadius: 8,
                        padding: '8px 14px',
                        minWidth: 130,
                    }}>
                        <p style={{ color: '#64748b', fontSize: '0.7rem', marginBottom: 4 }}>{type.replace(/_/g, ' ')}</p>
                        <div style={{ display: 'flex', gap: 8, fontSize: '0.82rem' }}>
                            <span style={{ color: '#f87171' }}>⏳ {counts.pending || 0}</span>
                            <span style={{ color: '#34d399' }}>✓ {counts.sent || 0}</span>
                            <span style={{ color: '#64748b' }}>✕ {counts.dismissed || 0}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function CareGapDashboard() {
    const [gaps, setGaps] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [toast, setToast] = useState('');

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [gapRes, analyticsRes] = await Promise.all([
                fetch(`${API}/api/caregap/pending`).then(r => r.json()),
                fetch(`${API}/api/caregap/analytics`).then(r => r.json()),
            ]);
            if (gapRes.success) setGaps(gapRes.data || []);
            if (analyticsRes.success) setStats(analyticsRes.data || {});
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    const handleScan = async () => {
        setScanning(true);
        await fetch(`${API}/api/caregap/scan`, { method: 'POST' });
        showToast('Scan triggered! Refreshing in 3 seconds...');
        setTimeout(() => { fetchAll(); setScanning(false); }, 3000);
    };

    const handleApprove = async (id, editedMessage) => {
        await fetch(`${API}/api/caregap/approve/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: editedMessage }),
        });
        setGaps(prev => prev.filter(g => g._id !== id));
        showToast('✅ Outreach sent via WhatsApp!');
        fetchAll();
    };

    const handleDismiss = async (id) => {
        await fetch(`${API}/api/caregap/dismiss/${id}`, { method: 'POST' });
        setGaps(prev => prev.filter(g => g._id !== id));
        showToast('Gap dismissed.');
        fetchAll();
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#F8FAFC',
            fontFamily: "'Inter', sans-serif",
            color: '#0F172A',
            padding: 32,
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>🏥 CareGap</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                        Proactive patient outreach engine
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={fetchAll}
                        style={{ padding: '8px 18px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, color: '#64748B', cursor: 'pointer', fontSize: '0.82rem' }}
                    >
                        🔄 Refresh
                    </button>
                    <button
                        onClick={handleScan}
                        disabled={scanning}
                        style={{ padding: '8px 18px', background: '#10B981', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                    >
                        {scanning ? 'Scanning...' : '🔍 Run Scan'}
                    </button>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div style={{
                    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8,
                    padding: '10px 18px', marginBottom: 20, color: '#0F172A', fontSize: '0.85rem',
                }}>
                    {toast}
                </div>
            )}

            {/* Stats Bar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                {[
                    { label: 'Pending Gaps', value: gaps.length, color: '#f59e0b' },
                    { label: 'Total Gap Types', value: Object.keys(stats).length, color: '#818cf8' },
                ].map(s => (
                    <div key={s.label} style={{
                        background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12,
                        padding: '14px 24px', minWidth: 140,
                    }}>
                        <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</p>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem' }}>{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Analytics */}
            <Analytics stats={stats} />

            {/* Gap Queue */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                <h2 style={{ marginTop: 0, color: '#0F172A', fontSize: '1.1rem' }}>
                    Pending Gaps ({gaps.length}) — Approve to send WhatsApp outreach
                </h2>

                {loading && <p style={{ color: '#64748B' }}>Loading...</p>}

                {!loading && gaps.length === 0 && (
                    <div style={{
                        textAlign: 'center', padding: '40px 20px',
                        border: '2px dashed #CBD5E1', borderRadius: 12,
                    }}>
                        <p style={{ color: '#64748B' }}>✅ No pending care gaps. All patients are up to date!</p>
                        <p style={{ color: '#0F172A', fontSize: '0.8rem' }}>Click "Run Scan" to check for new gaps.</p>
                    </div>
                )}

                {gaps.map(gap => (
                    <GapCard
                        key={gap._id}
                        gap={gap}
                        onApprove={handleApprove}
                        onDismiss={handleDismiss}
                    />
                ))}
            </div>

            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');`}</style>
        </div>
    );
}
