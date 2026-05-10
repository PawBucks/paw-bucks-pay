import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../MainVideo";
import { scale } from "../components/utils";

export const Scene1Hook: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const titleY = interpolate(spring({ frame: frame - 14, fps, config: { damping: 20 } }), [0, 1], [40, 0]);
  const titleO = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });
  const subO = interpolate(frame, [34, 54], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(spring({ frame: frame - 34, fps, config: { damping: 22 } }), [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 * s, textAlign: "center", maxWidth: width * 0.85 }}>
        <div style={{ transform: `scale(${logoScale})` }}>
          <Img src={staticFile("images/logo.png")} style={{ width: 220 * s, height: 220 * s, objectFit: "contain", filter: "drop-shadow(0 20px 40px rgba(47,165,168,0.35))" }} />
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
          Pet care that
          <br />
          <span style={{ color: theme.teal }}>pays you back.</span>
        </h1>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 38 * s,
            color: theme.inkSoft,
            margin: 0,
            opacity: subO,
            transform: `translateY(${subY}px)`,
            fontWeight: 500,
          }}
        >
          Save on every wag, purr & visit.
        </p>
      </div>
    </AbsoluteFill>
  );
};