import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PaySaveVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

export const PaySaveScene5EarnBack: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const ringSp = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const ringScale = interpolate(ringSp, [0, 1], [0.4, 1]);

  const checkLen = 100;
  const checkDraw = interpolate(frame, [12, 36], [checkLen, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titleO = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 30, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  const cardO = interpolate(frame, [60, 84], [0, 1], { extrapolateRight: "clamp" });
  const cardSp = spring({ frame: frame - 60, fps, config: { damping: 16 } });
  const cardScale = interpolate(cardSp, [0, 1], [0.7, 1]);

  // Earn counter
  const t = interpolate(frame, [70, 160], [0, 1], { extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const earned = (t * 12.36).toFixed(2);

  const tagO = interpolate(frame, [160, 190], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 * s }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 * s, textAlign: "center", maxWidth: width * 0.9 }}>
        <div style={{ transform: `scale(${ringScale})`, position: "relative", width: 170 * s, height: 170 * s }}>
          <svg width={170 * s} height={170 * s} viewBox="0 0 100 100">
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
            fontSize: 90 * s,
            margin: 0,
            opacity: titleO,
            transform: `translateY(${titleY}px)`,
            color: theme.ink,
            lineHeight: 1.02,
            letterSpacing: -2,
          }}
        >
          Paid. <span style={{ color: theme.teal }}>And earning again.</span>
        </h2>

        <div
          style={{
            opacity: cardO,
            transform: `scale(${cardScale})`,
            background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealDeep})`,
            color: "white",
            borderRadius: 36 * s,
            padding: `${34 * s}px ${50 * s}px`,
            boxShadow: `0 30px 80px ${theme.teal}55`,
            display: "flex",
            alignItems: "center",
            gap: 22 * s,
          }}
        >
          <Paw size={56 * s} color="white" />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 22 * s, opacity: 0.9, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>
              New PawBucks earned
            </div>
            <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 100 * s, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              ${earned}
            </div>
            <div style={{ fontSize: 22 * s, opacity: 0.92 }}>ready for your next bill</div>
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
          Pay your bills. Save every time. Earn for next time.
        </div>
      </div>
    </AbsoluteFill>
  );
};