import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top: Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: 48, fontWeight: 800, color: "#ffffff" }}>
            Account
          </span>
          <span style={{ fontSize: 48, fontWeight: 800, color: "#818cf8" }}>
            Cast
          </span>
          <span
            style={{
              fontSize: 48,
              fontWeight: 400,
              color: "#71717a",
              marginLeft: 8,
            }}
          >
            Dashboard
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "#a1a1aa",
            marginTop: 12,
          }}
        >
          PMF Experiments & Growth Dashboard
        </div>

        {/* Pipeline visualization */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: 48,
          }}
        >
          {[
            { label: "Qualification", count: "0", value: "" },
            { label: "Proposal", count: "4", value: "$5K" },
            { label: "Negotiation", count: "0", value: "" },
            { label: "Closed/Won", count: "0", value: "" },
          ].map((stage) => (
            <div
              key={stage.label}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "20px 28px",
                borderRadius: 12,
                border:
                  stage.count !== "0"
                    ? "2px solid #818cf8"
                    : "1px solid #3f3f46",
                background:
                  stage.count !== "0"
                    ? "rgba(129, 140, 248, 0.1)"
                    : "rgba(255,255,255,0.03)",
                minWidth: 180,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "#71717a",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {stage.label}
              </span>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: stage.count !== "0" ? "#ffffff" : "#3f3f46",
                  marginTop: 4,
                }}
              >
                {stage.count}
              </span>
              {stage.value && (
                <span style={{ fontSize: 16, color: "#818cf8", marginTop: 2 }}>
                  {stage.value}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Bottom stats */}
        <div
          style={{
            display: "flex",
            gap: "48px",
            marginTop: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, color: "#71717a", textTransform: "uppercase", letterSpacing: 1 }}>
              Best PMF Signal
            </span>
            <span style={{ fontSize: 40, fontWeight: 700, color: "#f59e0b" }}>
              75%
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, color: "#71717a", textTransform: "uppercase", letterSpacing: 1 }}>
              Active Campaigns
            </span>
            <span style={{ fontSize: 40, fontWeight: 700, color: "#ffffff" }}>
              9
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, color: "#71717a", textTransform: "uppercase", letterSpacing: 1 }}>
              Target
            </span>
            <span style={{ fontSize: 40, fontWeight: 700, color: "#818cf8" }}>
              80% PMF
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
