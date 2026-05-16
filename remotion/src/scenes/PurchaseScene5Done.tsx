import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PurchaseVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

export const PurchaseScene5Done: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const ringSp = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const ringScale = interpolate(ringSp, [0, 1], [0.4, 1]);

  const checkLen = 100;
  const checkDraw = interpolate(frame, [12, 36], [checkLen, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titleO = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 30, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  const earnedO = interpolate(frame, [60, 82], [0, 1], { extrapolateRight: "clamp" });
  const earnedSp = spring({ frame: frame - 60, fps, config: { damping: 16 } });
  const earnedScale = interpolate(earnedSp, [0, 1], [0.7, 1]);

  // Counter $0 -> $20 PawBucks earned
  const t = interpolate(frame, [70, 150], [0, 1], { extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const earned = (t * 20).toFixed(2);

  const tagO = interpolate(frame, [150, 175], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 * s }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36 * s, textAlign: "center", maxWidth: width * 0.9 }}>
        {/* Success ring */}
        <div style={{ transform: `scale(${ringScale})`, position: "relative", width: 180 * s, height: 180 * s }}>
          <svg width={180 * s} height={180 * s} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill={theme.teal} />
            <path
              d="M30 52 L45 67 L72 38"
              fill="none"
              stroke="white"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={checkLen}
              strokeDashoffset={checkDraw}
            />
          </svg>
        </div>

        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 96 * s,
            margin: 0,
            opacity: titleO,
            transform: `translateY(${titleY}px)`,
            color: theme.ink,
            lineHeight: 1.02,
            letterSpacing: -2,
          }}
        >
          Payment <span style={{ color: theme.teal }}>complete.</span>
        </h2>

        {/* Earned card */}
        <div
          style={{
            opacity: earnedO,
            transform: `scale(${earnedScale})`,
            background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealDeep})`,
            color: "white",
            borderRadius: 36 * s,
            padding: `${36 * s}px ${52 * s}px`,
            boxShadow: `0 30px 80px ${theme.teal}55`,
            display: "flex",
            alignItems: "center",
            gap: 22 * s,
          }}
        >
          <Paw size={56 * s} color="white" />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 22 * s, opacity: 0.9, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>
              You just earned
            </div>
            <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 100 * s, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              ${earned}
            </div>
            <div style={{ fontSize: 24 * s, opacity: 0.92 }}>in PawBucks for next time</div>
          </div>
        </div>

        <div
          style={{
            opacity: tagO,
            fontSize: 30 * s,
            color: theme.inkSoft,
            fontWeight: 600,
          }}
        >
          Every purchase pays you back.
        </div>
      </div>
    </AbsoluteFill>
  );
};