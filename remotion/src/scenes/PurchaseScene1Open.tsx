import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PurchaseVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

export const PurchaseScene1Open: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const badgeSp = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const titleO = interpolate(frame, [14, 32], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 14, fps, config: { damping: 22 } }), [0, 1], [40, 0]);
  const subO = interpolate(frame, [36, 60], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 * s }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 * s, textAlign: "center", maxWidth: width * 0.88 }}>
        <div
          style={{
            transform: `scale(${badgeSp})`,
            background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealDeep})`,
            color: "white",
            borderRadius: 999,
            padding: `${14 * s}px ${28 * s}px`,
            fontSize: 26 * s,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: 12 * s,
            boxShadow: `0 20px 40px ${theme.teal}55`,
          }}
        >
          <Paw size={28 * s} color="white" /> How to pay
        </div>
        <h1
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 110 * s,
            lineHeight: 1.02,
            color: theme.ink,
            margin: 0,
            opacity: titleO,
            transform: `translateY(${titleY}px)`,
            letterSpacing: -2,
          }}
        >
          Make a purchase
          <br />
          <span style={{ color: theme.teal }}>with PawBucks.</span>
        </h1>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 36 * s,
            color: theme.inkSoft,
            margin: 0,
            opacity: subO,
            fontWeight: 500,
          }}
        >
          A quick 4-step walkthrough for pet parents.
        </p>
      </div>
    </AbsoluteFill>
  );
};