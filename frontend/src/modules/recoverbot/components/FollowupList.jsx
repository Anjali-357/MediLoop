/**
 * frontend/src/modules/recoverbot/components/FollowupList.jsx
 * Active follow-ups table with status badges.
 */
import RiskBadge from "./RiskBadge";

const STATUS_PILL = {
    active: { bg: "#dbeafe22", color: "#2563EB" },
    flagged: { bg: "#fee2e222", color: "#DC2626" },
    completed: { bg: "#d1fae522", color: "#059669" },
};

export default function FollowupList({ followups = [], onSelect }) {
    if (followups.length === 0) {
        return (
            <p style={{ color: "#64748B", textAlign: "center", padding: "24px 0" }}>
                No follow-ups found.
            </p>
        );
    }

    return (
        <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                    <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        {["Patient", "Status", "Risk", "Score", "Created", ""].map((h) => (
                            <th
                                key={h}
                                style={{
                                    textAlign: "left",
                                    padding: "8px 12px",
                                    color: "#64748b",
                                    fontWeight: 600,
                                    fontSize: "0.72rem",
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                }}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {followups.map((f) => {
                        const sp = STATUS_PILL[f.status] ?? STATUS_PILL.active;
                        return (
                            <tr
                                key={f._id}
                                style={{
                                    borderBottom: "1px solid #E2E8F0",
                                    transition: "background 0.15s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                                <td style={{ padding: "10px 12px" }}>
                                    <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
                                        {f.patient_name || "Unknown Patient"}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(f.patient_id);
                                            alert(`Copied Patient ID:\n${f.patient_id}`);
                                        }}
                                        style={{
                                            background: "transparent",
                                            border: "1px solid #E2E8F0",
                                            color: "#64748b",
                                            fontSize: "0.65rem",
                                            padding: "2px 6px",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = "#64748B")}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                                    >
                                        [View ID]
                                    </button>
                                </td>
                                <td style={{ padding: "10px 12px" }}>
                                    <span
                                        style={{
                                            padding: "3px 9px",
                                            borderRadius: 9999,
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            background: sp.bg,
                                            color: sp.color,
                                        }}
                                    >
                                        {f.status.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: "10px 12px" }}>
                                    <RiskBadge label={f.risk_label} />
                                </td>
                                <td style={{ padding: "10px 12px", color: "#64748B" }}>
                                    {(f.risk_score * 100).toFixed(0)}%
                                </td>
                                <td style={{ padding: "10px 12px", color: "#64748b" }}>
                                    {new Date(f.created_at).toLocaleDateString()}
                                </td>
                                <td style={{ padding: "10px 12px" }}>
                                    <button
                                        onClick={() => onSelect && onSelect(f)}
                                        style={{
                                            padding: "4px 12px",
                                            borderRadius: 6,
                                            border: "1px solid #E2E8F0",
                                            background: "transparent",
                                            color: "#64748B",
                                            fontSize: "0.75rem",
                                            cursor: "pointer",
                                            transition: "all 0.15s",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "#F1F5F9";
                                            e.currentTarget.style.color = "#0F172A";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "transparent";
                                            e.currentTarget.style.color = "#64748B";
                                        }}
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
