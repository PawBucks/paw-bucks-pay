import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PaySaveVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

export const PaySaveScene3AutoApply: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const stepO = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const headO = interpolate(frame, [6, 24], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame: frame - 6, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  const cardSp = spring({ frame: frame - 16, fps, config: { damping: 18 } });
  const cardY = interpolate(cardSp, [0, 1], [60, 0]);
  const cardO = interpolate(frame, [16, 36], [0, 1], { extrapolateRight: "clamp" });

  // Stack reveal
  const total = 95.0;
  const welcomeT = interpolate(frame, [40, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const pbT = interpolate(frame, [70, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const welcome = welcomeT * 15.0; // $15 welcome credit
  const pawbucks = pbT * 18.2; // $18.20 in PawBucks
  const card = Math.max(0, total - welcome - pawbucks);

  const tickO = interpolate(frame, [125, 150], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: 60 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 * s, width: "100%", maxWidth: 1000 * s }}>
        <div style={{ opacity: stepO, fontSize: 22 * s, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: theme.tealDeep }}>
          Step 2
        </div>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 72 * s,
            margin: 0,
            opacity: headO,
            transform: `translateY(${headY}px)`,
            color: theme.ink,
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          We <span style={{ color: theme.teal }}>auto-apply</span> your savings.
        </h2>

        <div
          style={{
            opacity: cardO,
            transform: `translateY(${cardY}px)`,
            background: "white",
            borderRadius: 36 * s,
            padding: `${36 * s}px ${42 * s}px`,
            boxShadow: "0 30px 70px rgba(15,27,45,0.12)",
            width: "94%",
            border: `1px solid ${theme.ink}11`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 * s }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 * s }}>
              <Paw size={26 * s} color={theme.teal} />
              <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 24 * s, color: theme.ink }}>Happy Tails Grooming</span>
            </div>
            <span style={{ fontSize: 24 * s, fontWeight: 700, color: theme.inkSoft, fontVariantNumeric: "tabular-nums" }}>
              Total ${total.toFixed(2)}
            </span>
          </div>

          {/* Stacked savings rows */}
          <Row
            s={s}
            color={theme.gold}
            label="Welcome Credit"
            sub="Pet Fund · auto-applied"
            value={`-$${welcome.toFixed(2)}`}
            appearAt={40}
            frame={frame}
          />
          <Row
            s={s}
            color={theme.teal}
            label="PawBucks Wallet"
            sub="Earned · auto-applied"
            value={`-$${pawbucks.toFixed(2)}`}
            appearAt={70}
            frame={frame}
          />
          <Row
            s={s}
            color={theme.inkSoft}
            label="Card on file"
            sub="Covers the rest"
            value={`$${card.toFixed(2)}`}
            appearAt={100}
            frame={frame}
            neutral
          />

          {/* Total bar */}
          <div
            style={{
              opacity: tickO,
              marginTop: 22 * s,
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
            ✓ You save ${(welcome + pawbucks).toFixed(2)} on this bill
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Row: React.FC<{
  s: number;
  color: string;
  label: string;
  sub: string;
  value: string;
  appearAt: number;
  frame: number;
  neutral?: boolean;
}> = ({ s, color, label, sub, value, appearAt, frame, neutral }) => {
  const o = interpolate(frame, [appearAt, appearAt + 18], [0, 1], { extrapolateRight: "clamp" });
  const x = interpolate(frame, [appearAt, appearAt + 22], [-20, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        opacity: o,
        transform: `translateX(${x}px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${14 * s}px 0`,
        borderTop: `1px solid #0F1B2D11`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 * s }}>
        <span style={{ width: 12 * s, height: 36 * s, borderRadius: 6 * s, background: color }} />
        <div>
          <div style={{ fontFamily: "inherit", fontWeight: 700, fontSize: 26 * s, color: "#0F1B2D" }}>{label}</div>
          <div style={{ fontSize: 18 * s, color: "#243042", marginTop: 2 * s }}>{sub}</div>
        </div>
      </div>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontWeight: 800,
          fontSize: 30 * s,
          color: neutral ? "#0F1B2D" : color,
        }}
      >
        {value}
      </span>
    </div>
  );
};