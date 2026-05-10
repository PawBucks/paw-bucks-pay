import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../MerchantVideo";
import { scale } from "../components/utils";

const Stat: React.FC<{ label: string; target: number; prefix?: string; suffix?: string; appear: number; accent: string; s: number }> = ({ label, target, prefix = "", suffix = "", appear, accent, s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - appear, fps, config: { damping: 16, stiffness: 140 } });
  const y = interpolate(sp, [0, 1], [60, 0]);
  const o = interpolate(frame, [appear, appear + 14], [0, 1], { extrapolateRight: "clamp" });
  const t = interpolate(frame, [appear + 6, appear + 60], [0, 1], { extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const value = (t * target).toFixed(target % 1 === 0 ? 0 : 0);
  return (
    <div style={{ background: "white", borderRadius: 28 * s, padding: `${28 * s}px ${32 * s}px`, boxShadow: "0 24px 48px rgba(15,27,45,0.12)", border: `1px solid ${accent}33`, transform: `translateY(${y}px)`, opacity: o, minWidth: 280 * s }}>
      <div style={{ fontSize: 22 * s, fontWeight: 600, color: theme.inkSoft, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</div>
      <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 84 * s, color: accent, lineHeight: 1, marginTop: 6 * s, fontVariantNumeric: "tabular-nums" }}>
        {prefix}{Number(value).toLocaleString()}{suffix}
      </div>
    </div>
  );
};

export const MerchantScene3Dashboard: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);
  const portrait = height > width;

  const headO = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ padding: 70 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 40 * s, alignItems: "center", maxWidth: width * 0.92 }}>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 76 * s, color: theme.ink, margin: 0, opacity: headO, transform: `translateY(${headY}px)`, lineHeight: 1.05, letterSpacing: -1.5, textAlign: "center" }}>
          A <span style={{ color: theme.teal }}>real-time dashboard</span>
          <br />
          for every sale.
        </h2>
        <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", gap: 28 * s, justifyContent: "center", flexWrap: "wrap" }}>
          <Stat label="Sales this month" target={12480} prefix="$" appear={22} accent={theme.tealDeep} s={s} />
          <Stat label="Returning customers" target={284} appear={44} accent={theme.teal} s={s} />
          <Stat label="Cashback issued" target={6240} prefix="$" appear={66} accent={theme.gold} s={s} />
        </div>
        <div style={{ opacity: interpolate(frame, [90, 110], [0, 1], { extrapolateRight: "clamp" }), display: "flex", gap: 14 * s, flexWrap: "wrap", justifyContent: "center" }}>
          {["Live transactions", "Repeat-visit insights", "Tax vault", "Tip tracking"].map((t) => (
            <div key={t} style={{ background: `${theme.teal}15`, color: theme.tealDeep, borderRadius: 999, padding: `${10 * s}px ${22 * s}px`, fontWeight: 600, fontSize: 22 * s, border: `1px solid ${theme.teal}33` }}>{t}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};