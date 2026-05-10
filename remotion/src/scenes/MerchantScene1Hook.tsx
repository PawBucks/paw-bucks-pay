import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../MerchantVideo";
import { scale } from "../components/utils";

export const MerchantScene1Hook: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);
  const portrait = height > width;

  const imgSp = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const titleO = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 10, fps, config: { damping: 20 } }), [0, 1], [40, 0]);
  const subO = interpolate(frame, [34, 54], [0, 1], { extrapolateRight: "clamp" });
  const chipO = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 * s }}>
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center", gap: 60 * s, maxWidth: width * 0.92 }}>
        <div
          style={{
            transform: `scale(${interpolate(imgSp, [0, 1], [0.85, 1])}) rotate(-2deg)`,
            borderRadius: 36 * s,
            overflow: "hidden",
            boxShadow: "0 30px 80px rgba(15,27,45,0.25)",
            border: `8px solid white`,
            flexShrink: 0,
          }}
        >
          <Img src={staticFile("images/merchant.png")} style={{ width: (portrait ? 520 : 480) * s, height: (portrait ? 460 : 560) * s, objectFit: "cover" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 * s, maxWidth: 760 * s, textAlign: portrait ? "center" : "left", alignItems: portrait ? "center" : "flex-start" }}>
          <h1
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 92 * s,
              lineHeight: 1.02,
              color: theme.ink,
              margin: 0,
              opacity: titleO,
              transform: `translateY(${titleY}px)`,
              letterSpacing: -2,
            }}
          >
            Turn visits into
            <br />
            <span style={{ color: theme.teal }}>loyal regulars.</span>
          </h1>
          <p style={{ fontSize: 34 * s, color: theme.inkSoft, margin: 0, opacity: subO, fontWeight: 500 }}>
            PawBucks brings pet parents back, again and again.
          </p>
          <div style={{ opacity: chipO, display: "flex", alignItems: "center", gap: 12 * s, background: "white", borderRadius: 999, padding: `${12 * s}px ${24 * s}px`, border: `1px solid ${theme.teal}33`, boxShadow: "0 12px 28px rgba(15,27,45,0.10)", color: theme.tealDeep, fontWeight: 700, fontSize: 24 * s }}>
            <span style={{ width: 12 * s, height: 12 * s, borderRadius: "50%", background: theme.teal }} />
            For Merchants
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};