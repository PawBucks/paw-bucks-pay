import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";
import { theme } from "../theme";
import { fonts } from "../MainVideo";
import { scale } from "../components/utils";

const TierCard: React.FC<{ label: string; mult: string; tag: string; appear: number; accent: string; s: number }> = ({ label, mult, tag, appear, accent, s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - appear, fps, config: { damping: 14, stiffness: 160 } });
  const y = interpolate(sp, [0, 1], [80, 0]);
  const o = interpolate(frame, [appear, appear + 14], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        background: "white",
        borderRadius: 28 * s,
        padding: `${28 * s}px ${24 * s}px`,
        textAlign: "center",
        boxShadow: "0 24px 48px rgba(15,27,45,0.14)",
        border: `2px solid ${accent}`,
        transform: `translateY(${y}px)`,
        opacity: o,
        minWidth: 240 * s,
      }}
    >
      <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 22 * s, color: theme.inkSoft, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</div>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 88 * s, color: accent, lineHeight: 1, marginTop: 6 * s }}>{mult}</div>
      <div style={{ fontSize: 22 * s, color: theme.inkSoft, marginTop: 4 * s }}>{tag}</div>
    </div>
  );
};

export const Scene3Earn: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);
  const portrait = height > width;

  const headO = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ padding: 70 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 50 * s, maxWidth: width * 0.92 }}>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 800,
            fontSize: 78 * s,
            color: theme.ink,
            margin: 0,
            opacity: headO,
            transform: `translateY(${headY}px)`,
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          Pay at partner shops.
          <br />
          <span style={{ color: theme.teal }}>Earn cashback every time.</span>
        </h2>
        <div
          style={{
            display: "flex",
            flexDirection: portrait ? "column" : "row",
            gap: 28 * s,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <TierCard label="Free" mult="10×" tag="cashback per $1" appear={22} accent={theme.inkSoft} s={s} />
          <TierCard label="PawPass" mult="20×" tag="cashback per $1" appear={42} accent={theme.teal} s={s} />
          <TierCard label="PawPass+" mult="30×" tag="cashback per $1" appear={62} accent={theme.gold} s={s} />
        </div>
        <div
          style={{
            display: "flex",
            gap: 18 * s,
            opacity: interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" }),
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {["Vets", "Groomers", "Pet stores", "Boarding", "Trainers"].map((t) => (
            <div key={t} style={{ background: `${theme.teal}15`, color: theme.tealDeep, borderRadius: 999, padding: `${10 * s}px ${22 * s}px`, fontWeight: 600, fontSize: 22 * s, border: `1px solid ${theme.teal}33` }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};