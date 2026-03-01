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
// AppContext exported from context/AppContext.jsx
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
    const [searchQuery, setSearchQuery] = useState("");
    const [riskFilter, setRiskFilter] = useState("ALL");

    const patientId = currentPatient?._id ?? currentPatient?.id ?? null;

    useEffect(() => {
        if (!authToken) return;
        setLoading(true);
        // Force load ALL followups for the dashboard view instead of filtering by the hardcoded mock patient
        const followupUrl = `/api/recoverbot/followups`;
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
        background: tab === name ? "#10B981" : "transparent",
        color: tab === name ? "#FFFFFF" : "#64748b",
        transition: "all 0.2s",
    });

    const filterFn = (f) => {
        const matchesName = (f.patient_name || "Unknown Patient").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRisk = riskFilter === "ALL" || (f.risk_label || "").toUpperCase() === riskFilter;
        return matchesName && matchesRisk;
    };

    const filteredFollowups = followups.filter(filterFn);
    const filteredFlagged = flagged.filter(filterFn);

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", color: "#0F172A", minHeight: "100vh", background: "#F8FAFC" }}>
            {/* Header */}
            <div
                style={{
                    background: "linear-gradient(135deg, #FFFFFF 0%, #F1F5F9 100%)",
                    padding: "24px 32px",
                    borderBottom: "1px solid #E2E8F0",
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
                                    background: s.alert ? "#7f1d1d22" : "#FFFFFF",
                                    border: `1px solid ${s.alert ? "#ef4444" : "#E2E8F0"}`,
                                    minWidth: 100,
                                }}
                            >
                                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.alert ? "#f87171" : "#0F172A" }}>
                                    {s.value}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 32px", borderBottom: "1px solid #E2E8F0", background: "#FFFFFF" }}>
                <div style={{ display: "flex" }}>
                    <button style={tabStyle("followups")} onClick={() => setTab("followups")}>
                        Follow-ups
                    </button>
                    <button style={tabStyle("flagged")} onClick={() => setTab("flagged")}>
                        🚨 Flagged{flagged.length > 0 && <span style={{ marginLeft: 6, background: "#ef4444", color: "#0F172A", borderRadius: 9999, padding: "1px 6px", fontSize: "0.65rem" }}>{flagged.length}</span>}
                    </button>
                    <button style={tabStyle("alerts")} onClick={() => setTab("alerts")}>
                        Live Alerts
                    </button>
                </div>
                {!selected && tab !== "alerts" && (
                    <div style={{ display: "flex", gap: "10px", paddingBottom: "8px", paddingTop: "8px" }}>
                        <select
                            value={riskFilter}
                            onChange={(e) => setRiskFilter(e.target.value)}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "20px",
                                border: "1px solid #E2E8F0",
                                background: "#FFFFFF",
                                color: "#0F172A",
                                fontSize: "0.8rem",
                                outline: "none",
                                cursor: "pointer",
                                transition: "border-color 0.2s",
                            }}
                            onFocus={(e) => (e.target.style.borderColor = "#10B981")}
                            onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                        >
                            <option value="ALL">All Risks</option>
                            <option value="CRITICAL">🔴 Critical</option>
                            <option value="HIGH">🟠 High</option>
                            <option value="MEDIUM">🟡 Medium</option>
                            <option value="LOW">🟢 Low</option>
                        </select>
                        <input
                            type="text"
                            placeholder="🔍 Search patient name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "20px",
                                border: "1px solid #E2E8F0",
                                background: "#FFFFFF",
                                color: "#0F172A",
                                fontSize: "0.8rem",
                                outline: "none",
                                width: "220px",
                                transition: "border-color 0.2s",
                            }}
                            onFocus={(e) => (e.target.style.borderColor = "#10B981")}
                            onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                        />
                    </div>
                )}
            </div>

            {/* Content */}
            <div style={{ padding: "24px 32px" }}>
                {loading && (
                    <p style={{ color: "#64748B", textAlign: "center" }}>Loading…</p>
                )}

                {!loading && selected && (
                    <div>
                        <button
                            onClick={() => setSelected(null)}
                            style={{
                                marginBottom: 16,
                                padding: "7px 14px",
                                borderRadius: 8,
                                border: "1px solid #E2E8F0",
                                background: "transparent",
                                color: "#64748B",
                                cursor: "pointer",
                                fontSize: "0.82rem",
                            }}
                        >
                            ← Back
                        </button>
                        <div
                            style={{
                                background: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                                borderRadius: 12,
                                padding: 20,
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                                <div>
                                    <h2 style={{ margin: 0, color: "#0F172A" }}>Follow-up Detail — {selected.patient_name}</h2>
                                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.8rem", fontFamily: "monospace" }}>{selected._id}</p>
                                </div>
                                <RiskBadge label={selected.risk_label} />
                            </div>

                            {/* Conversation Log — always visible */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: "#0F172A", marginBottom: 12 }}>💬 Conversation History</h3>
                                {(!selected.conversation_log || selected.conversation_log.length === 0) ? (
                                    <p style={{ color: "#64748B", fontSize: "0.85rem" }}>No messages yet. Waiting for patient reply via WhatsApp.</p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto", padding: "4px 0" }}>
                                        {selected.conversation_log.map((entry, i) => (
                                            <div key={i} style={{ display: "flex", justifyContent: entry.role === "bot" ? "flex-start" : "flex-end" }}>
                                                <div style={{
                                                    maxWidth: "75%",
                                                    padding: "10px 14px",
                                                    borderRadius: entry.role === "bot" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                                                    background: entry.role === "bot" ? "#F1F5F9" : "#10B981",
                                                    color: "#0F172A",
                                                    fontSize: "0.85rem",
                                                    lineHeight: 1.6,
                                                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                                                }}>
                                                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{entry.message}</p>
                                                    <p style={{ margin: "6px 0 0", fontSize: "0.68rem", opacity: 0.5, textAlign: entry.role === "bot" ? "left" : "right" }}>
                                                        {entry.role === "bot" ? "🤖 RecoverBot" : "👤 Patient"} · {new Date(entry.timestamp).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <CheckinHistory followup={selected} />
                        </div>
                    </div>
                )}

                {!loading && !selected && tab === "followups" && (
                    <div
                        style={{
                            background: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: 12,
                            padding: 20,
                        }}
                    >
                        <h2 style={{ marginTop: 0, color: "#0F172A" }}>Patient Follow-ups</h2>
                        <FollowupList followups={filteredFollowups} onSelect={setSelected} />
                    </div>
                )}

                {!loading && !selected && tab === "flagged" && (
                    <div
                        style={{
                            background: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: 12,
                            padding: 20,
                        }}
                    >
                        <h2 style={{ marginTop: 0, color: "#f87171" }}>🚨 High-Risk Patients</h2>
                        <FollowupList followups={filteredFlagged} onSelect={setSelected} />
                    </div>
                )}

                {!loading && !selected && tab === "alerts" && (
                    <div
                        style={{
                            background: "#FFFFFF",
                            border: "1px solid #E2E8F0",
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
