/**
 * frontend/src/modules/recoverbot/components/CheckinHistory.jsx
 * Timeline of check-ins with conversation log accordion.
 */
import { useState } from "react";

const STATUS_COLOR = {
    pending: "#64748B",
    completed: "#10b981",
    missed: "#f87171",
};

function ConvLog({ log }) {
    if (!log || log.length === 0) return <p style={{ color: "#64748B", fontSize: "0.8rem" }}>No messages yet.</p>;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {log.map((entry, i) => (
                <div
                    key={i}
                    style={{
                        display: "flex",
                        justifyContent: entry.role === "bot" ? "flex-start" : "flex-end",
                    }}
                >
                    <div
                        style={{
                            maxWidth: "80%",
                            padding: "8px 12px",
                            borderRadius: entry.role === "bot" ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                            background: entry.role === "bot" ? "#0F172A" : "#3b82f6",
                            color: "#0F172A",
                            fontSize: "0.82rem",
                            lineHeight: 1.5,
                        }}
                    >
                        <p style={{ margin: 0 }}>{entry.message}</p>
                        <p style={{ margin: "4px 0 0", fontSize: "0.68rem", opacity: 0.55 }}>
                            {new Date(entry.timestamp).toLocaleString()}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function CheckinHistory({ followup }) {
    const [openSlot, setOpenSlot] = useState(null);
    const slots = followup?.checkin_schedule ?? [];
    const log = followup?.conversation_log ?? [];

    return (
        <div>
            <h3 style={{ color: "#0F172A", marginBottom: 12 }}>Check-in Schedule</h3>
            {slots.length === 0 && <p style={{ color: "#64748B" }}>No check-ins scheduled.</p>}
            {slots.map((slot, i) => (
                <div
                    key={i}
                    style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: 10,
                        marginBottom: 8,
                        overflow: "hidden",
                    }}
                >
                    <button
                        onClick={() => setOpenSlot(openSlot === i ? null : i)}
                        style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "#0F172A",
                            fontSize: "0.85rem",
                        }}
                    >
                        <span>
                            <span
                                style={{
                                    display: "inline-block",
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    background: STATUS_COLOR[slot.status] ?? "#64748B",
                                    marginRight: 8,
                                }}
                            />
                            Check-in {i + 1} — {new Date(slot.scheduled_at).toLocaleDateString()} {new Date(slot.scheduled_at).toLocaleTimeString()}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                            {slot.status.toUpperCase()} {openSlot === i ? "▲" : "▼"}
                        </span>
                    </button>
                    {openSlot === i && (
                        <div style={{ padding: "0 14px 14px" }}>
                            <ConvLog log={log} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
