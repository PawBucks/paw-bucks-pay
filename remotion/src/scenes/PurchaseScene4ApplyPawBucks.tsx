import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PurchaseVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

export const PurchaseScene4ApplyPawBucks: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const stepO = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const headO = interpolate(frame, [6, 24], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame: frame - 6, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  // Slider animation: PawBucks portion grows from 0 -> 40
  const sliderT = interpolate(frame, [30, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const pbApplied = sliderT * 40;
  const cardCharge = 100 - pbApplied;

  const cardSp = spring({ frame: frame - 16, fps, config: { damping: 18 } });
  const cardY = interpolate(cardSp, [0, 1], [60, 0]);
  const cardO = interpolate(frame, [16, 36], [0, 1], { extrapolateRight: "clamp" });

  const tickO = interpolate(frame, [120, 140], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: 60 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 * s, width: "100%", maxWidth: 1000 * s }}>
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
          Apply your <span style={{ color: theme.teal }}>PawBucks</span>.
        </h2>

        <div
          style={{
            opacity: cardO,
            transform: `translateY(${cardY}px)`,
            background: "white",
            borderRadius: 36 * s,
            padding: `${40 * s}px ${44 * s}px`,
            boxShadow: "0 30px 70px rgba(15,27,45,0.12)",
            width: "92%",
            border: `1px solid ${theme.ink}11`,
          }}
        >
          {/* Wallet header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 * s }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 * s }}>
              <Paw size={28 * s} color={theme.teal} />
              <span style={{ fontSize: 24 * s, fontWeight: 700, color: theme.ink, fontFamily: fonts.display }}>PawBucks balance</span>
            </div>
            <span style={{ fontSize: 28 * s, fontWeight: 800, color: theme.tealDeep, fontVariantNumeric: "tabular-nums" }}>$48.20</span>
          </div>

          {/* Slider track */}
          <div style={{ position: "relative", height: 22 * s, background: `${theme.teal}22`, borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${sliderT * 100}%`,
                background: `linear-gradient(90deg, ${theme.teal}, ${theme.tealDeep})`,
                borderRadius: 999,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `calc(${sliderT * 100}% - ${18 * s}px)`,
                top: "50%",
                transform: "translateY(-50%)",
                width: 36 * s,
                height: 36 * s,
                background: "white",
                borderRadius: "50%",
                boxShadow: `0 6px 14px ${theme.teal}66`,
                border: `3px solid ${theme.teal}`,
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 * s, fontSize: 22 * s, color: theme.inkSoft }}>
            <span>Apply PawBucks</span>
            <span style={{ fontWeight: 700, color: theme.teal, fontVariantNumeric: "tabular-nums" }}>${pbApplied.toFixed(2)}</span>
          </div>

          {/* Split summary */}
          <div style={{ marginTop: 30 * s, display: "flex", flexDirection: "column", gap: 12 * s }}>
            <Row label="PawBucks applied" value={`-$${pbApplied.toFixed(2)}`} accent />
            <Row label="Card charge" value={`$${cardCharge.toFixed(2)}`} />
            <div style={{ borderTop: `1px solid ${theme.ink}11`, paddingTop: 14 * s, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 30 * s, color: theme.ink }}>Total</span>
              <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 30 * s, color: theme.ink, fontVariantNumeric: "tabular-nums" }}>$100.00</span>
            </div>
          </div>

          {/* Confirm chip */}
          <div
            style={{
              opacity: tickO,
              marginTop: 26 * s,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12 * s,
              background: `${theme.teal}15`,
              color: theme.tealDeep,
              borderRadius: 999,
              padding: `${14 * s}px ${24 * s}px`,
              fontSize: 24 * s,
              fontWeight: 700,
            }}
          >
            ✓ Saving $40.00 on this visit
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Row: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 * 1, color: accent ? "#1F7A7C" : "#243042", fontWeight: accent ? 700 : 500 }}>
    <span>{label}</span>
    <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
  </div>
);