/**
 * frontend/src/modules/recoverbot/components/AlertFeed.jsx
 * Real-time WebSocket alert stream for the doctor dashboard.
 * Reads the shared WebSocket from AppContext.
 */
import { useContext, useEffect, useState } from "react";

const RISK_COLORS = {
    HIGH: { bg: "#7f1d1d22", border: "#ef4444", text: "#fca5a5" },
    CRITICAL: { bg: "#701a7522", border: "#d946ef", text: "#f0abfc" },
};

function AlertCard({ alert }) {
    const { bg, border, text } = RISK_COLORS[alert.risk_label] ?? RISK_COLORS.HIGH;
    return (
        <div
            style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 10,
                padding: "10px 14px",
                animation: "slideIn 0.3s ease",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: text, fontWeight: 700, fontSize: "0.9rem" }}>
                    🚨 Patient Deteriorating — {alert.risk_label}
                </span>
                <span style={{ color: "#64748b", fontSize: "0.72rem" }}>
                    {new Date(alert.ts).toLocaleTimeString()}
                </span>
            </div>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "0.78rem" }}>
                Patient ID: {alert.patient_id} · Risk Score: {(alert.risk_score * 100).toFixed(0)}%
            </p>
        </div>
    );
}

// Auto-detect WS URL: use same host in Docker, fall back to localhost:8000 in dev
const DEFAULT_WS_URL = (() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/^https?/, proto.slice(0, -1))
        : `${proto}//${window.location.host}`;
    return `${host}/api/recoverbot/ws/alerts`;
})();

export default function AlertFeed({ wsUrl = DEFAULT_WS_URL }) {
    const [alerts, setAlerts] = useState([]);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === "RISK_ALERT") {
                    setAlerts((prev) => [{ ...data, ts: Date.now() }, ...prev].slice(0, 50));
                }
            } catch { }
        };

        return () => ws.close();
    }, [wsUrl]);

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ color: "#e2e8f0", margin: 0 }}>Live Alerts</h3>
                <span
                    style={{
                        fontSize: "0.72rem",
                        padding: "3px 10px",
                        borderRadius: 9999,
                        background: connected ? "#d1fae522" : "#fee2e222",
                        color: connected ? "#10b981" : "#f87171",
                        border: `1px solid ${connected ? "#10b981" : "#f87171"}`,
                    }}
                >
                    {connected ? "● LIVE" : "○ DISCONNECTED"}
                </span>
            </div>

            {alerts.length === 0 && (
                <p style={{ color: "#475569", fontSize: "0.85rem", textAlign: "center", padding: "24px 0" }}>
                    No alerts yet. Monitoring active patients…
                </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alerts.map((a, i) => (
                    <AlertCard key={i} alert={a} />
                ))}
            </div>
        </div>
    );
}
