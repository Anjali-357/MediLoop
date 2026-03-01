import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import PatientOnboardingModal from '../../components/PatientOnboardingModal';

const API = 'http://localhost:8000';
const AUTO_REFRESH_MS = 30000;

export default function DoctorDashboard() {
    const [patients, setPatients] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [followups, setFollowups] = useState([]);
    const [careGaps, setCareGaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastFetch, setLastFetch] = useState(null);

    // Modal state
    const [isModalOpen, setModalOpen] = useState(false);

    // Context & Navigation
    const { setCurrentPatient, setCurrentDoctor, authToken } = useContext(AppContext);
    const navigate = useNavigate();

    // Bulk approve state
    const [selectedGaps, setSelectedGaps] = useState(new Set());
    const [approving, setApproving] = useState(false);

    const fetchAll = useCallback(async () => {
        try {
            const [pt, sess, fu, gaps] = await Promise.all([
                fetch(`${API}/api/commhub/patients`).then(r => r.json()),
                fetch(`${API}/api/commhub/sessions`).then(r => r.json()),
                fetch(`${API}/api/recoverbot/followups`, { headers: { 'Authorization': `Bearer ${authToken}` } }).then(r => r.json()).catch(() => ({ data: [] })),
                fetch(`${API}/api/caregap/pending`, { headers: { 'Authorization': `Bearer ${authToken}` } }).then(r => r.json()).catch(() => ({ data: [] })),
            ]);

            if (pt.success) setPatients(pt.data || []);
            if (sess.success) setSessions(sess.data || []);
            if (fu.success) setFollowups(fu.data || []);
            if (gaps && gaps.success) setCareGaps(gaps.data || []);

            setLastFetch(new Date());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        const t = setInterval(fetchAll, AUTO_REFRESH_MS);
        return () => clearInterval(t);
    }, [fetchAll]);

    // Data Processing 
    const sessionByPatient = {};
    sessions.forEach(s => { sessionByPatient[s.patient_id] = s; });

    const followupByPatient = {};
    followups.forEach(f => { followupByPatient[f.patient_id] = f; });

    const enrichedPatients = patients.map(p => {
        const f = followupByPatient[p._id];
        const s = sessionByPatient[p._id];
        return {
            ...p,
            session: s,
            followup: f,
            risk: f?.risk_label || 'UNKNOWN',
            suggested_action: f?.suggested_action || (f?.risk_label === 'HIGH' || f?.risk_label === 'CRITICAL' ? 'Review History' : 'Monitor'),
            last_active: s?.last_message_ts || p.last_active_at || p.created_at
        };
    });

    // 1. All Patients (Sort by Risk then Activity)
    const displayPatients = enrichedPatients.sort((a, b) => {
        const riskWeight = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'UNKNOWN': 0 };
        const weightA = riskWeight[a.risk] || 0;
        const weightB = riskWeight[b.risk] || 0;

        if (weightA !== weightB) return weightB - weightA;
        return new Date(b.last_active) - new Date(a.last_active);
    });

    // 2. Overview Stats
    const totalMonitored = patients.length;
    const highRiskCount = enrichedPatients.filter(p => ['CRITICAL', 'HIGH'].includes(p.risk)).length;

    // For now, proxy "Pain Alerts" via high risk or explicit checking if we had pain_scores
    const painAlertsCount = enrichedPatients.filter(p => p.session?.last_intent === 'PAIN').length;
    const pendingGapsCount = careGaps.length;

    // Handlers
    const handleToggleGap = (id) => {
        const next = new Set(selectedGaps);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedGaps(next);
    };

    const handleSelectAllGaps = () => {
        if (selectedGaps.size === careGaps.length) {
            setSelectedGaps(new Set());
        } else {
            setSelectedGaps(new Set(careGaps.map(g => g._id || g.id)));
        }
    };

    const handleBulkApprove = async () => {
        if (selectedGaps.size === 0) return;
        setApproving(true);
        try {
            await fetch(`${API}/api/caregap/approve-bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gap_ids: Array.from(selectedGaps), send_messages: true })
            });
            setSelectedGaps(new Set());
            fetchAll();
        } catch (e) {
            console.error('Bulk approve failed', e);
        } finally {
            setApproving(false);
        }
    };

    const handleMarkResolved = async (patientId) => {
        // Optimistic UI update or API call to dismiss alert 
        // For demo, we just refetch, assuming a separate endpoint exists or we ignore it
        fetchAll();
    };

    const handleViewPatient = async (patient) => {
        try {
            // Provide a mock doctor context for testing Scribe since it requires one
            const loginRes = await fetch(`${API}/api/identity/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: "System Admin", age: 40 }),
            });
            const loginData = await loginRes.json();

            if (loginRes.ok && loginData.success) {
                setCurrentDoctor(loginData.doctor);
            } else {
                setCurrentDoctor({ name: "Dr. Aryan Patel", id: "doc_123" });
            }
        } catch (e) {
            setCurrentDoctor({ name: "Dr. Aryan Patel", id: "doc_123" });
        }

        setCurrentPatient(patient);
        navigate('/patient');
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#10B981', fontSize: '1.2rem', fontFamily: "'Outfit', sans-serif" }}>Loading Clinical Command Center...</div>
            </div>
        );
    }

    // ── Styles ────────────────────────────────────────────────────────────────
    const theme = {
        bg: '#F8FAFC',
        glass: '#FFFFFF',
        glassBorder: '#E2E8F0',
        primary: '#10B981', // Brand Green
        primaryHover: '#059669',
        accentBlue: '#0EA5E9',
        amber: '#F59E0B',
        red: '#EF4444',
        textMain: '#0F172A',
        textMuted: '#64748B'
    };

    const glassCard = {
        background: theme.glass,
        border: `1px solid ${theme.glassBorder}`,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
    };

    function timeAgo(dateString) {
        if (!dateString) return '';
        const diff = Date.now() - new Date(dateString).getTime();
        const hrs = Math.floor(diff / 3600000);
        if (hrs < 1) return 'Just now';
        return `${hrs}h ago`;
    }

    return (
        <div className="w-full h-full flex flex-col p-6 overflow-y-auto">
            {/* Header section with Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexShrink: 0 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px', color: theme.textMain }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `linear-gradient(135deg, ${theme.primary}, ${theme.accentBlue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px rgba(16, 185, 129, 0.4)` }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                        </div>
                        MediLoop
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: theme.textMuted, fontSize: '0.9rem' }}>Clinical Command Center · Live</p>
                </div>

                <button
                    onClick={() => setModalOpen(true)}
                    style={{
                        background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
                        color: '#fff', border: 'none', borderRadius: '12px',
                        padding: '12px 24px', fontSize: '1rem', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: `0 8px 24px rgba(16, 185, 129, 0.25)`,
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    New Consultation
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                {/* Section 3: Active Monitoring Overview (Moved to top for dashboard feel) */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
                    {[
                        { label: 'Patients Monitored', value: totalMonitored, color: theme.accentBlue },
                        { label: 'High-Risk', value: highRiskCount, color: theme.red },
                        { label: 'Pain Alerts', value: painAlertsCount, color: theme.amber },
                        { label: 'Care Gaps', value: pendingGapsCount, color: theme.primary }
                    ].map((stat, i) => (
                        <div key={i} style={{ ...glassCard, display: 'flex', flexDirection: 'column', padding: '24px' }}>
                            <span style={{ color: theme.textMuted, fontSize: '0.9rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '8px', color: stat.color, textShadow: `0 0 20px ${stat.color}40` }}>
                                {stat.value}
                            </div>
                        </div>
                    ))}
                </section>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

                    {/* Section 1: All Patients */}
                    <section>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: theme.textMain }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: theme.accentBlue, boxShadow: `0 0 10px ${theme.accentBlue}` }}></span>
                            All Patients
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {displayPatients.length === 0 ? (
                                <div style={{ ...glassCard, textAlign: 'center', color: theme.textMuted, padding: '40px' }}>
                                    No patients found.
                                </div>
                            ) : displayPatients.map(p => {
                                const isCritical = p.risk === 'CRITICAL';
                                const borderColor = isCritical ? theme.red : theme.amber;
                                const isUnresponsive = !isCritical && p.risk !== 'HIGH'; // Meaning it was caught by 48h rule

                                return (
                                    <div key={p._id} style={{
                                        ...glassCard,
                                        borderLeft: `4px solid ${isUnresponsive ? theme.textMuted : borderColor}`,
                                        position: 'relative', overflow: 'hidden',
                                        transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer',
                                    }}
                                        onClick={() => handleViewPatient(p)}
                                        onMouseOver={e => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
                                        }}>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {isCritical && <span style={{ color: theme.red }}>🚨</span>}
                                                    {isUnresponsive && <span style={{ color: theme.amber }}>⏳</span>}
                                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: theme.textMain }}>{p.name}</h3>
                                                </div>
                                                <p style={{ margin: '4px 0 0 0', color: theme.textMuted, fontSize: '0.85rem' }}>
                                                    {isUnresponsive ? 'Unresponsive > 48h' : `${p.risk} Recovery Risk`} · {timeAgo(p.last_active)}
                                                </p>
                                            </div>

                                            <div style={{ background: `${theme.bg}`, border: `1px solid ${theme.glassBorder}`, padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', color: theme.textMain }}>
                                                Suggested Action: <span style={{ color: borderColor, fontWeight: 600 }}>{p.suggested_action}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Section 2: Pending Preventive Actions */}
                    <section>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: theme.textMain }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: theme.primary, boxShadow: `0 0 10px ${theme.primary}` }}></span>
                            Pending Preventive Actions
                        </h2>

                        <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '20px', borderBottom: `1px solid ${theme.glassBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.bg }}>
                                <div style={{ fontSize: '0.9rem', color: theme.textMuted }}>
                                    <strong style={{ color: theme.textMain }}>{careGaps.length}</strong> patients need outreach today
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={handleSelectAllGaps} style={{ background: 'transparent', border: 'none', color: theme.accentBlue, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>
                                        {selectedGaps.size === careGaps.length && careGaps.length > 0 ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <button
                                        onClick={handleBulkApprove}
                                        disabled={selectedGaps.size === 0 || approving}
                                        style={{
                                            background: selectedGaps.size > 0 ? theme.primary : '#E2E8F0',
                                            border: 'none', color: selectedGaps.size > 0 ? '#fff' : theme.textMuted, padding: '6px 16px', borderRadius: '6px',
                                            fontSize: '0.85rem', fontWeight: 600, cursor: selectedGaps.size > 0 ? 'pointer' : 'not-allowed',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        {approving ? 'Approving...' : `Approve (${selectedGaps.size})`}
                                    </button>
                                </div>
                            </div>

                            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                {careGaps.length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: theme.textMuted }}>
                                        No pending care gaps.
                                    </div>
                                ) : careGaps.map(gap => {
                                    const id = gap._id || gap.id;
                                    const pt = patients.find(p => p._id === gap.patient_id);
                                    return (
                                        <div key={id} style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.glassBorder}`, display: 'flex', alignItems: 'center', gap: '16px', transition: 'background 0.2s', background: selectedGaps.has(id) ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }} onClick={() => handleToggleGap(id)}>
                                            <input
                                                type="checkbox"
                                                checked={selectedGaps.has(id)}
                                                onChange={() => { }}
                                                style={{ width: '18px', height: '18px', accentColor: theme.primary, cursor: 'pointer' }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: theme.textMain }}>{pt?.name || 'Unknown Patient'}</div>
                                                <div style={{ color: theme.textMuted, fontSize: '0.8rem', marginTop: '2px' }}>
                                                    {gap.gap_type.replace('_', ' ').toUpperCase()} · Generated {timeAgo(gap.created_at)}
                                                </div>
                                            </div>
                                            <button style={{ background: theme.bg, border: `1px solid ${theme.glassBorder}`, color: theme.textMain, padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', transition: 'background 0.2s' }}
                                                onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                                onMouseOut={e => e.currentTarget.style.background = theme.bg}>
                                                Review Individually
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Float Modal */}
            <PatientOnboardingModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} onCreated={fetchAll} />
        </div>
    );
}
