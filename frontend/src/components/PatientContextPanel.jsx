import React, { useEffect, useState } from 'react';

const API = 'http://localhost:8000';

const theme = {
    bg: '#F8FAFC',
    glass: '#FFFFFF',
    glassBorder: '#E2E8F0',
    primary: '#10B981', // Brand Green
    amber: '#F59E0B',
    red: '#EF4444',
    textMain: '#0F172A',
    textMuted: '#64748B'
};

const RISK_COLORS = {
    LOW: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: theme.primary },
    MEDIUM: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: theme.amber },
    HIGH: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: theme.red },
    CRITICAL: { bg: 'rgba(239, 68, 68, 0.2)', border: theme.red, text: '#fca5a5' },
    UNKNOWN: { bg: theme.glass, border: theme.glassBorder, text: theme.textMuted },
};

function timeAgo(dateString) {
    if (!dateString) return '';
    const diff = Date.now() - new Date(dateString).getTime();
    if (diff < 86400000) return 'Today';
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
}

export default function PatientContextPanel({ patientId }) {
    const [ctx, setCtx] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!patientId) return;
        setLoading(true);
        fetch(`${API}/api/patient/context/${patientId}`)
            .then(r => r.json())
            .then(r => { if (r.success) setCtx(r.data); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [patientId]);

    if (!patientId) return null;

    const risk = ctx?.risk_status || 'UNKNOWN';
    const riskCfg = RISK_COLORS[risk] || RISK_COLORS.UNKNOWN;

    return (
        <div style={{
            background: theme.bg,
            border: `1px solid ${theme.glassBorder}`,
            borderRadius: '16px',
            padding: '24px',
            marginTop: '24px',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            color: theme.textMain,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
        }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: theme.textMain, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🧠</span> Patient Intelligence
            </h3>

            {loading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
                </div>
            )}

            {!loading && ctx && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                        <div style={{ background: riskCfg.bg, border: `1px solid ${riskCfg.border}`, borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recovery Risk</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.2rem', color: riskCfg.text }}>{risk}</p>
                        </div>

                        {ctx.latest_pain_score !== null && ctx.latest_pain_score !== undefined && (
                            <div style={{ background: theme.glass, border: `1px solid ${theme.glassBorder}`, borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latest Pain</p>
                                <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.2rem', color: ctx.latest_pain_score >= 7 ? theme.red : (ctx.latest_pain_score >= 4 ? theme.amber : theme.primary) }}>
                                    {ctx.latest_pain_score}/10
                                </p>
                            </div>
                        )}

                        <div style={{ background: theme.glass, border: `1px solid ${theme.glassBorder}`, borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Gaps</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.2rem', color: ctx.pending_gaps > 0 ? theme.amber : theme.primary }}>
                                {ctx.pending_gaps}
                            </p>
                        </div>

                        <div style={{ background: theme.glass, border: `1px solid ${theme.glassBorder}`, borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>History</p>
                            <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.2rem', color: theme.textMain }}>
                                {ctx.recent_consultations?.length || 0} visits
                            </p>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                        <h4 style={{ fontSize: '0.85rem', color: theme.textMuted, margin: '0 0 12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Unified Timeline
                        </h4>

                        {ctx.timeline?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {ctx.timeline.map((item, i) => {
                                    const { type, timestamp, data } = item;

                                    let icon = '📄';
                                    let color = theme.primary;
                                    let content = '';
                                    let title = '';

                                    if (type === 'consultation') {
                                        icon = '🩺'; color = '#0ea5e9'; title = 'Consultation';
                                        content = data.summary_short || 'Consultation recorded';
                                    } else if (type === 'pain_score') {
                                        icon = '📉'; color = data.score >= 7 ? theme.red : (data.score >= 4 ? theme.amber : theme.primary);
                                        title = 'Pain Score Scan';
                                        content = `Reported pain: ${data.score}/10`;
                                    } else if (type === 'patient_message') {
                                        icon = '💬'; color = '#fbbf24'; title = 'Patient Message';
                                        content = `"${data.message}"`;
                                    } else if (type === 'care_gap') {
                                        icon = '🔎'; color = '#c084fc'; title = 'Care Gap Identified';
                                        content = `${data.gap_type.replace(/_/g, ' ')} — ${data.status}`;
                                    }

                                    return (
                                        <div key={i} style={{ paddingLeft: '16px', borderLeft: `2px solid ${color}`, position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '-5px', top: '0', width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }}></div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                                                    <span style={{ fontSize: '0.75rem', color: color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {title}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>
                                                    {timeAgo(timestamp)}
                                                </span>
                                            </div>

                                            <p style={{ margin: 0, color: theme.textMain, fontSize: '0.85rem', lineHeight: '1.4' }}>
                                                {content}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: '24px 0', textAlign: 'center', color: theme.textMuted, fontSize: '0.9rem' }}>
                                No timeline activity found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
