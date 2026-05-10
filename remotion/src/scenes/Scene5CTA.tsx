import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../MainVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

export const Scene5CTA: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const logoSp = spring({ frame, fps, config: { damping: 12, stiffness: 110 } });
  const headO = interpolate(frame, [16, 36], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame: frame - 16, fps, config: { damping: 22 } }), [0, 1], [30, 0]);
  const urlO = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const urlSp = spring({ frame: frame - 40, fps, config: { damping: 14, stiffness: 140 } });
  const tagO = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" });

  // gentle breathing on the logo
  const breathe = 1 + Math.sin(frame / 24) * 0.015;

  return (
    <AbsoluteFill style={{ padding: 60 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36 * s, textAlign: "center" }}>
        <div style={{ transform: `scale(${logoSp * breathe})` }}>
          <Img src={staticFile("images/logo.png")} style={{ width: 200 * s, height: 200 * s, objectFit: "contain", filter: "drop-shadow(0 20px 40px rgba(47,165,168,0.4))" }} />
        </div>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 96 * s,
            margin: 0,
            color: theme.ink,
            opacity: headO,
            transform: `translateY(${headY}px)`,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          Join the pack.
        </h2>
        <div
          style={{
            opacity: urlO,
            transform: `scale(${interpolate(urlSp, [0, 1], [0.9, 1])})`,
            background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealDeep})`,
            color: "white",
            borderRadius: 999,
            padding: `${22 * s}px ${56 * s}px`,
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 56 * s,
            boxShadow: `0 24px 60px ${theme.teal}66`,
            letterSpacing: 0.5,
          }}
        >
          pawbucks.app
        </div>
        <div style={{ opacity: tagO, fontSize: 30 * s, color: theme.inkSoft, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 * s }}>
          Free to join · Welcome credit inside <Paw size={32 * s} color={theme.teal} />
        </div>
      </div>
    </AbsoluteFill>
  );
};