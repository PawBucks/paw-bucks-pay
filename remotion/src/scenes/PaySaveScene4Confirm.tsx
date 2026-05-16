import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PaySaveVideo";
import { scale } from "../components/utils";

export const PaySaveScene4Confirm: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const stepO = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const headO = interpolate(frame, [6, 24], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame: frame - 6, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  // Button appears + press
  const btnSp = spring({ frame: frame - 24, fps, config: { damping: 16 } });
  const btnO = interpolate(frame, [24, 44], [0, 1], { extrapolateRight: "clamp" });
  const btnScale = interpolate(btnSp, [0, 1], [0.85, 1]);
  const press = frame > 70 && frame < 84 ? 0.94 : 1;

  // Counter animation $0 -> $33.20 saved
  const t = interpolate(frame, [85, 160], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const saved = (t * 33.2).toFixed(2);
  const savedO = interpolate(frame, [85, 110], [0, 1], { extrapolateRight: "clamp" });
  const savedSp = spring({ frame: frame - 85, fps, config: { damping: 14 } });
  const savedScale = interpolate(savedSp, [0, 1], [0.6, 1]);

  return (
    <AbsoluteFill style={{ padding: 60 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 * s, width: "100%", maxWidth: 1000 * s }}>
        <div style={{ opacity: stepO, fontSize: 22 * s, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: theme.tealDeep }}>
          Step 3
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
          One tap to <span style={{ color: theme.teal }}>confirm</span>.
        </h2>

        <div
          style={{
            opacity: btnO,
            transform: `scale(${btnScale * press})`,
            background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealDeep})`,
            color: "white",
            borderRadius: 999,
            padding: `${26 * s}px ${52 * s}px`,
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 40 * s,
            letterSpacing: 0.5,
            boxShadow: `0 26px 60px ${theme.teal}66`,
            display: "flex",
            alignItems: "center",
            gap: 16 * s,
          }}
        >
          Pay $61.80 · Save $33.20
        </div>

        {/* Savings reveal */}
        <div
          style={{
            opacity: savedO,
            transform: `scale(${savedScale})`,
            background: "white",
            borderRadius: 36 * s,
            padding: `${32 * s}px ${48 * s}px`,
            border: `2px solid ${theme.teal}33`,
            boxShadow: "0 24px 60px rgba(15,27,45,0.10)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6 * s,
          }}
        >
          <div style={{ fontSize: 22 * s, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, color: theme.inkSoft }}>
            You just saved
          </div>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 130 * s,
              lineHeight: 1,
              color: theme.tealDeep,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${saved}
          </div>
          <div style={{ fontSize: 22 * s, color: theme.inkSoft, fontWeight: 500 }}>
            on this Pay &amp; Save checkout
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};