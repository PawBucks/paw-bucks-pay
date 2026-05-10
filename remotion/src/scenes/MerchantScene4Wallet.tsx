import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../MerchantVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

export const MerchantScene4Wallet: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);
  const portrait = height > width;

  const headO = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  const cardSp = spring({ frame: frame - 16, fps, config: { damping: 16 } });
  const cardY = interpolate(cardSp, [0, 1], [80, 0]);
  const cardO = interpolate(frame, [16, 36], [0, 1], { extrapolateRight: "clamp" });

  const t = interpolate(frame, [22, 110], [0, 1], { extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const value = (t * 1248.5).toFixed(2);

  const chipO = interpolate(frame, [110, 130], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: 70 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 * s, width: "100%" }}>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 76 * s, color: theme.ink, margin: 0, opacity: headO, transform: `translateY(${headY}px)`, lineHeight: 1.05, letterSpacing: -1.5, textAlign: "center" }}>
          Your <span style={{ color: theme.teal }}>Rewards Wallet</span>
          <br />
          fills itself.
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
            minWidth: portrait ? width * 0.82 : 760 * s,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -120, right: -120, width: 360, height: 360, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 * s, opacity: 0.95, fontSize: 22 * s, textTransform: "uppercase", letterSpacing: 2 }}>
            <Paw size={28 * s} color="white" /> Merchant Rewards Wallet
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 180 * s, lineHeight: 1, marginTop: 8 * s, fontVariantNumeric: "tabular-nums" }}>${value}</div>
          <div style={{ fontSize: 28 * s, opacity: 0.9, marginTop: 4 * s }}>auto-funded from every sale</div>
        </div>
        <div style={{ opacity: chipO, display: "flex", alignItems: "center", gap: 14 * s, background: "white", borderRadius: 999, padding: `${14 * s}px ${28 * s}px`, boxShadow: "0 12px 28px rgba(15,27,45,0.10)", border: `1px solid ${theme.teal}33`, color: theme.tealDeep, fontWeight: 700, fontSize: 26 * s }}>
          <span style={{ width: 14 * s, height: 14 * s, borderRadius: "50%", background: theme.teal, boxShadow: `0 0 12px ${theme.teal}` }} />
          No points to manage. 100% reimbursed.
        </div>
      </div>
    </AbsoluteFill>
  );
};