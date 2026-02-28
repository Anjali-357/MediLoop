/**
 * frontend/src/modules/recoverbot/components/RiskBadge.jsx
 * Colour-coded risk label pill.
 */
const COLORS = {
    LOW: { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
    MEDIUM: { bg: "#fef3c7", text: "#78350f", dot: "#f59e0b" },
    HIGH: { bg: "#fee2e2", text: "#7f1d1d", dot: "#ef4444" },
    CRITICAL: { bg: "#fce7f3", text: "#701a75", dot: "#d946ef" },
};

export default function RiskBadge({ label = "LOW" }) {
    const c = COLORS[label] ?? COLORS.LOW;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 10px",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                background: c.bg,
                color: c.text,
            }}
        >
            <span
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: c.dot,
                    display: "inline-block",
                    animation: label === "CRITICAL" ? "pulse 1s ease-in-out infinite" : "none",
                }}
            />
            {label}
        </span>
    );
}
