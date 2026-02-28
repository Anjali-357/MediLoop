/**
 * App.jsx — Standalone demo wrapper for RecoverBot.
 * In MediLoop production this module is loaded by the shell's router.
 */
import { useState, useEffect, createContext, useContext } from "react";
import RecoverBot from "./modules/recoverbot/index.jsx";

// ─── Minimal AppContext for standalone usage ──────────────────────────────────
export const AppContext = createContext({
    authToken: null,
    currentPatient: null,
});

// ─── Demo Login Screen ────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
    const [token, setToken] = useState("");
    const [patientId, setPatientId] = useState("");

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "100vh",
                background: "linear-gradient(135deg, #0a0f1e 0%, #1e1b4b 100%)",
                fontFamily: "'Inter', sans-serif",
            }}
        >
            <div
                style={{
                    background: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: 16,
                    padding: 36,
                    width: 380,
                    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
                }}
            >
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🤖</div>
                    <h1 style={{ color: "#e2e8f0", fontSize: "1.4rem", margin: 0, fontWeight: 800 }}>RecoverBot</h1>
                    <p style={{ color: "#64748b", fontSize: "0.82rem", marginTop: 4 }}>MediLoop · Module 2 · Standalone Demo</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                        <label style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: 6 }}>
                            JWT TOKEN
                        </label>
                        <input
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="Bearer eyJ..."
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                background: "#1e293b",
                                border: "1px solid #334155",
                                borderRadius: 8,
                                color: "#e2e8f0",
                                fontSize: "0.82rem",
                                outline: "none",
                                fontFamily: "monospace",
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: 6 }}>
                            PATIENT ID (optional)
                        </label>
                        <input
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            placeholder="MongoDB ObjectId"
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                background: "#1e293b",
                                border: "1px solid #334155",
                                borderRadius: 8,
                                color: "#e2e8f0",
                                fontSize: "0.82rem",
                                outline: "none",
                                fontFamily: "monospace",
                            }}
                        />
                    </div>
                    <button
                        onClick={() => onLogin(token || "demo-token", patientId || null)}
                        style={{
                            width: "100%",
                            padding: "12px",
                            background: "linear-gradient(135deg, #1d4ed8, #4f46e5)",
                            border: "none",
                            borderRadius: 8,
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            marginTop: 4,
                            transition: "opacity 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                        Enter Dashboard →
                    </button>
                    <p style={{ textAlign: "center", color: "#475569", fontSize: "0.72rem" }}>
                        No token? Click the button anyway to browse with demo data.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
    // Automatically skip the login screen by using a pre-generated permanent token
    const DEMO_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkb2N0b3JfZGVtbyIsInJvbGUiOiJkb2N0b3IifQ.z3ArbSmR-ZEqgIojV66e0hwo-3v1_rZflIu0uf1QECA";
    const [authToken, setAuthToken] = useState(DEMO_TOKEN);
    const [currentPatient, setCurrentPatient] = useState(null);

    if (!authToken) {
        return (
            <LoginScreen
                onLogin={(t, pid) => {
                    setAuthToken(t);
                    setCurrentPatient(pid ? { _id: pid } : null);
                }}
            />
        );
    }

    return (
        <AppContext.Provider value={{ authToken, currentPatient }}>
            <RecoverBot />
        </AppContext.Provider>
    );
}
