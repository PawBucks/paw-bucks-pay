import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PaySaveVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

export const PaySaveScene1Hook: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const badgeSp = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const titleO = interpolate(frame, [14, 32], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 14, fps, config: { damping: 22 } }), [0, 1], [40, 0]);
  const subO = interpolate(frame, [40, 64], [0, 1], { extrapolateRight: "clamp" });

  // Coin drop animation
  const coinO = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" });
  const coinY = interpolate(spring({ frame: frame - 70, fps, config: { damping: 10, stiffness: 140 } }), [0, 1], [-60, 0]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 * s }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 * s, textAlign: "center", maxWidth: width * 0.9 }}>
        <div
          style={{
            transform: `scale(${badgeSp})`,
            background: `linear-gradient(135deg, ${theme.gold}, #B8862F)`,
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
            boxShadow: `0 20px 40px ${theme.gold}66`,
          }}
        >
          <Paw size={28 * s} color="white" /> Pay &amp; Save
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
          Every payment
          <br />
          <span style={{ color: theme.teal }}>pays you back.</span>
        </h1>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 34 * s,
            color: theme.inkSoft,
            margin: 0,
            opacity: subO,
            fontWeight: 500,
          }}
        >
          Meet Pay &amp; Save — built into every PawBucks checkout.
        </p>
        <div
          style={{
            opacity: coinO,
            transform: `translateY(${coinY}px)`,
            display: "flex",
            alignItems: "center",
            gap: 16 * s,
            background: "white",
            border: `2px solid ${theme.teal}33`,
            borderRadius: 999,
            padding: `${14 * s}px ${28 * s}px`,
            boxShadow: "0 14px 32px rgba(15,27,45,0.10)",
          }}
        >
          <span style={{ width: 14 * s, height: 14 * s, borderRadius: "50%", background: theme.teal, boxShadow: `0 0 14px ${theme.teal}` }} />
          <span style={{ fontWeight: 700, color: theme.tealDeep, fontSize: 26 * s }}>Vet · Groomer · Pet Store · Daycare</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};