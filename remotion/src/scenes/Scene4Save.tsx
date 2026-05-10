import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../MainVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

export const Scene4Save: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);
  const portrait = height > width;

  const headO = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  // Animated counter $0 -> $48.20
  const t = interpolate(frame, [20, 110], [0, 1], { extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const value = (t * 48.2).toFixed(2);

  const cardSp = spring({ frame: frame - 16, fps, config: { damping: 16 } });
  const cardY = interpolate(cardSp, [0, 1], [80, 0]);
  const cardO = interpolate(frame, [16, 36], [0, 1], { extrapolateRight: "clamp" });

  // Auto-apply chip
  const chipO = interpolate(frame, [110, 130], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: 70 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 * s, width: "100%" }}>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 78 * s,
            margin: 0,
            opacity: headO,
            transform: `translateY(${headY}px)`,
            color: theme.ink,
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          Your savings <span style={{ color: theme.teal }}>auto-apply</span>
          <br />
          at checkout.
        </h2>

        <div
          style={{
            transform: `translateY(${cardY}px)`,
            opacity: cardO,
            background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealDeep})`,
            color: "white",
            borderRadius: 36 * s,
            padding: `${50 * s}px ${60 * s}px`,
            boxShadow: `0 30px 80px ${theme.teal}55`,
            minWidth: portrait ? width * 0.78 : 720 * s,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -120, right: -120, width: 360, height: 360, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 * s, opacity: 0.95, fontSize: 22 * s, textTransform: "uppercase", letterSpacing: 2 }}>
            <Paw size={28 * s} color="white" /> PawBucks Wallet
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 200 * s, lineHeight: 1, marginTop: 8 * s, fontVariantNumeric: "tabular-nums" }}>
            ${value}
          </div>
          <div style={{ fontSize: 28 * s, opacity: 0.9, marginTop: 4 * s }}>ready to use automatically</div>
        </div>

        <div
          style={{
            opacity: chipO,
            display: "flex",
            alignItems: "center",
            gap: 14 * s,
            background: "white",
            borderRadius: 999,
            padding: `${14 * s}px ${28 * s}px`,
            boxShadow: "0 12px 28px rgba(15,27,45,0.10)",
            border: `1px solid ${theme.teal}33`,
            color: theme.tealDeep,
            fontWeight: 700,
            fontSize: 26 * s,
          }}
        >
          <span style={{ width: 14 * s, height: 14 * s, borderRadius: "50%", background: theme.teal, boxShadow: `0 0 12px ${theme.teal}` }} />
          No points to manage. Just savings.
        </div>
      </div>
    </AbsoluteFill>
  );
};