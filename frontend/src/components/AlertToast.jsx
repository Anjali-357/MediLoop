import React, { useEffect } from 'react';

export default function AlertToast({ alert, onClose }) {
    useEffect(() => {
        // Auto-dismiss non-critical alerts after 8 seconds
        if (alert.risk !== 'CRITICAL') {
            const timer = setTimeout(onClose, 8000);
            return () => clearTimeout(timer);
        }
    }, [alert, onClose]);

    const isCritical = alert.risk === 'CRITICAL';

    return (
        <div style={{
            background: isCritical ? 'rgba(69, 10, 10, 0.95)' : 'rgba(30, 41, 59, 0.95)',
            border: `1px solid ${isCritical ? '#dc2626' : '#334155'}`,
            borderRadius: '16px',
            padding: '20px 24px',
            boxShadow: isCritical ? '0 20px 40px rgba(220, 38, 38, 0.3)' : '0 20px 40px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(20px)',
            color: '#f8fafc',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'auto',
            animation: 'slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            width: '380px',
            borderLeft: `4px solid ${isCritical ? '#ef4444' : '#fbbf24'}`
        }}>
            <style>
                {`
                @keyframes slideInRight {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                `}
            </style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem' }}>{isCritical ? '🚨' : '⚠️'}</span>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: isCritical ? '#fca5a5' : '#fcd34d' }}>
                            {alert.title || 'AI Escalation Alert'}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Patient: {alert.patient_name || 'Unknown'}
                        </span>
                    </div>
                </div>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>✕</button>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {alert.message}
            </p>

            {alert.suggested_action && (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 14px', marginTop: '4px' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Suggested Action</p>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: isCritical ? '#f87171' : '#fbbf24' }}>
                        {alert.suggested_action}
                    </p>
                </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                    background: isCritical ? '#dc2626' : '#0ea5e9', color: '#fff',
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    transition: 'background 0.2s',
                    boxShadow: isCritical ? '0 4px 14px rgba(220, 38, 38, 0.4)' : '0 4px 14px rgba(14, 165, 233, 0.3)'
                }} onClick={() => {
                    window.location.href = '/control';
                }}>
                    Review Now
                </button>
                <button onClick={onClose} style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${isCritical ? '#7f1d1d' : '#334155'}`,
                    background: 'transparent', color: '#cbd5e1',
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    transition: 'background 0.2s'
                }}>
                    Dismiss
                </button>
            </div>
        </div>
    );
}
