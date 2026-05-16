import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PurchaseVideo";
import { scale } from "../components/utils";

const LINES = [
  { label: "Full Groom — Golden Retriever", amt: "$85.00" },
  { label: "Nail Trim", amt: "$15.00" },
  { label: "Subtotal", amt: "$100.00", muted: true },
];

export const PurchaseScene3Checkout: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const stepO = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const headO = interpolate(frame, [6, 24], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame: frame - 6, fps, config: { damping: 22 } }), [0, 1], [30, 0]);
  const cardSp = spring({ frame: frame - 24, fps, config: { damping: 18 } });
  const cardY = interpolate(cardSp, [0, 1], [60, 0]);
  const cardO = interpolate(frame, [24, 44], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: 60 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 * s, width: "100%", maxWidth: 1000 * s }}>
        <div style={{ opacity: stepO, fontSize: 22 * s, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: theme.tealDeep }}>
          Step 2
        </div>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 76 * s,
            margin: 0,
            opacity: headO,
            transform: `translateY(${headY}px)`,
            color: theme.ink,
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          Tap <span style={{ color: theme.teal }}>Pay with PawBucks</span>.
        </h2>

        {/* Receipt card */}
        <div
          style={{
            opacity: cardO,
            transform: `translateY(${cardY}px)`,
            background: "white",
            borderRadius: 36 * s,
            padding: `${40 * s}px ${44 * s}px`,
            boxShadow: "0 30px 70px rgba(15,27,45,0.12)",
            width: "92%",
            border: `1px solid ${theme.ink}11`,
          }}
        >
          <div style={{ fontSize: 22 * s, color: theme.inkSoft, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 20 * s }}>
            Happy Tails Grooming
          </div>
          {LINES.map((l, i) => {
            const o = interpolate(frame, [50 + i * 10, 70 + i * 10], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  opacity: o,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: `${14 * s}px 0`,
                  borderTop: i > 0 ? `1px solid ${theme.ink}11` : "none",
                  fontSize: 30 * s,
                  color: l.muted ? theme.inkSoft : theme.ink,
                  fontWeight: l.muted ? 700 : 500,
                  fontFamily: l.muted ? fonts.display : fonts.body,
                }}
              >
                <span>{l.label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{l.amt}</span>
              </div>
            );
          })}

          {/* CTA button */}
          {(() => {
            const btnSp = spring({ frame: frame - 100, fps, config: { damping: 14 } });
            const btnScale = interpolate(btnSp, [0, 1], [0.85, 1]);
            const btnO = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" });
            const pulse = 1 + Math.sin(Math.max(0, frame - 140) * 0.18) * 0.025;
            return (
              <div
                style={{
                  marginTop: 28 * s,
                  opacity: btnO,
                  transform: `scale(${btnScale * pulse})`,
                  background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealDeep})`,
                  color: "white",
                  borderRadius: 999,
                  padding: `${22 * s}px ${36 * s}px`,
                  textAlign: "center",
                  fontFamily: fonts.display,
                  fontWeight: 800,
                  fontSize: 34 * s,
                  letterSpacing: 0.5,
                  boxShadow: `0 20px 50px ${theme.teal}66`,
                }}
              >
                Pay with PawBucks · $100.00
              </div>
            );
          })()}
        </div>
      </div>
    </AbsoluteFill>
  );
};