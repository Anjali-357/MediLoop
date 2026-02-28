/**
 * frontend/src/modules/recoverbot/index.jsx
 * RecoverBot main module component.
 * Reads authToken and currentPatient from AppContext (MediLoop shared context).
 *
 * Usage in MediLoop shell:
 *   import RecoverBot from './modules/recoverbot';
 *   <RecoverBot />
 */
import { useContext, useEffect, useState, createContext } from "react";
import FollowupList from "./components/FollowupList";
import AlertFeed from "./components/AlertFeed";
import CheckinHistory from "./components/CheckinHistory";
import RiskBadge from "./components/RiskBadge";
// AppContext exported from context/AppContext (works both standalone and in MediLoop shell)
import { AppContext } from "../../context/AppContext";

const API_BASE = import.meta.env?.VITE_API_URL ?? "http://localhost:8000";

// ─── Context hook ─────────────────────────────────────────────────────────────
function useAppContext() {
    return useContext(AppContext) ?? { authToken: null, currentPatient: null };
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path, token) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = await res.json();
    return json;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RecoverBot() {
    const { authToken, currentPatient } = useAppContext();

    const [tab, setTab] = useState("followups"); // 'followups' | 'flagged' | 'alerts'
    const [followups, setFollowups] = useState([]);
    const [flagged, setFlagged] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);

    const patientId = currentPatient?._id ?? currentPatient?.id ?? null;

    useEffect(() => {
        if (!authToken) return;
        setLoading(true);
        // If a specific patient is selected load their data; otherwise load ALL followups
        const followupUrl = patientId
            ? `/api/recoverbot/followups/${patientId}`
            : `/api/recoverbot/followups`;
        Promise.all([
            apiFetch(followupUrl, authToken),
            apiFetch("/api/recoverbot/risk-flagged", authToken),
        ])
            .then(([fu, fl]) => {
                setFollowups(fu.data ?? []);
                setFlagged(fl.data ?? []);
            })
            .finally(() => setLoading(false));
    }, [authToken, patientId]);

    const tabStyle = (name) => ({
        padding: "8px 18px",
        borderRadius: "8px 8px 0 0",
        border: "none",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: "0.82rem",
        background: tab === name ? "#1e40af" : "transparent",
        color: tab === name ? "#fff" : "#64748b",
        transition: "all 0.2s",
    });

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", color: "#e2e8f0", minHeight: "100vh", background: "#0a0f1e" }}>
            {/* Header */}
            <div
                style={{
                    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
                    padding: "24px 32px",
                    borderBottom: "1px solid #1e293b",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: "1.8rem" }}>🤖</span>
                    <div>
                        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
                            RecoverBot
                        </h1>
                        <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "0.8rem" }}>
                            Post-discharge follow-up & AI risk monitoring
                        </p>
                    </div>
                </div>

                {/* Stats bar */}
                {!loading && (
                    <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
                        {[
                            { label: "Active Follow-ups", value: followups.filter((f) => f.status === "active").length },
                            { label: "Flagged Patients", value: flagged.length, alert: flagged.length > 0 },
                            { label: "Completed", value: followups.filter((f) => f.status === "completed").length },
                        ].map((s) => (
                            <div
                                key={s.label}
                                style={{
                                    padding: "10px 16px",
                                    borderRadius: 10,
                                    background: s.alert ? "#7f1d1d22" : "#1e293b",
                                    border: `1px solid ${s.alert ? "#ef4444" : "#334155"}`,
                                    minWidth: 100,
                                }}
                            >
                                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.alert ? "#f87171" : "#e2e8f0" }}>
                                    {s.value}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", padding: "0 32px", borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
                <button style={tabStyle("followups")} onClick={() => setTab("followups")}>
                    Follow-ups
                </button>
                <button style={tabStyle("flagged")} onClick={() => setTab("flagged")}>
                    🚨 Flagged{flagged.length > 0 && <span style={{ marginLeft: 6, background: "#ef4444", color: "#fff", borderRadius: 9999, padding: "1px 6px", fontSize: "0.65rem" }}>{flagged.length}</span>}
                </button>
                <button style={tabStyle("alerts")} onClick={() => setTab("alerts")}>
                    Live Alerts
                </button>
            </div>

            {/* Content */}
            <div style={{ padding: "24px 32px" }}>
                {loading && (
                    <p style={{ color: "#475569", textAlign: "center" }}>Loading…</p>
                )}

                {!loading && tab === "followups" && (
                    !selected ? (
                        <div
                            style={{
                                background: "#0f172a",
                                border: "1px solid #1e293b",
                                borderRadius: 12,
                                padding: 20,
                            }}
                        >
                            <h2 style={{ marginTop: 0, color: "#e2e8f0" }}>Patient Follow-ups</h2>
                            <FollowupList followups={followups} onSelect={setSelected} />
                        </div>
                    ) : (
                        <div>
                            <button
                                onClick={() => setSelected(null)}
                                style={{
                                    marginBottom: 16,
                                    padding: "7px 14px",
                                    borderRadius: 8,
                                    border: "1px solid #334155",
                                    background: "transparent",
                                    color: "#94a3b8",
                                    cursor: "pointer",
                                    fontSize: "0.82rem",
                                }}
                            >
                                ← Back
                            </button>
                            <div
                                style={{
                                    background: "#0f172a",
                                    border: "1px solid #1e293b",
                                    borderRadius: 12,
                                    padding: 20,
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                                    <div>
                                        <h2 style={{ margin: 0, color: "#e2e8f0" }}>Follow-up Detail</h2>
                                        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.8rem", fontFamily: "monospace" }}>{selected._id}</p>
                                    </div>
                                    <RiskBadge label={selected.risk_label} />
                                </div>
                                <CheckinHistory followup={selected} />
                            </div>
                        </div>
                    )
                )}

                {!loading && tab === "flagged" && (
                    <div
                        style={{
                            background: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: 12,
                            padding: 20,
                        }}
                    >
                        <h2 style={{ marginTop: 0, color: "#f87171" }}>🚨 High-Risk Patients</h2>
                        <FollowupList followups={flagged} onSelect={setSelected} />
                    </div>
                )}

                {tab === "alerts" && (
                    <div
                        style={{
                            background: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: 12,
                            padding: 20,
                        }}
                    >
                        <AlertFeed wsUrl={`${API_BASE.replace("http", "ws")}/api/recoverbot/ws/alerts`} />
                    </div>
                )}
            </div>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes slideIn { from{transform:translateY(-8px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
        </div>
    );
}
