import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../MerchantVideo";
import { scale } from "../components/utils";

const Step: React.FC<{ n: number; title: string; sub: string; appear: number; s: number }> = ({ n, title, sub, appear, s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - appear, fps, config: { damping: 18, stiffness: 140 } });
  const x = interpolate(sp, [0, 1], [-60, 0]);
  const o = interpolate(frame, [appear, appear + 14], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 * s, background: "white", borderRadius: 22 * s, padding: `${20 * s}px ${28 * s}px`, boxShadow: "0 16px 36px rgba(15,27,45,0.10)", border: `1px solid ${theme.tealGlow}33`, transform: `translateX(${x}px)`, opacity: o, minWidth: 460 * s }}>
      <div style={{ width: 64 * s, height: 64 * s, borderRadius: "50%", background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealGlow})`, color: "white", fontFamily: fonts.display, fontWeight: 700, fontSize: 32 * s, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 32 * s, color: theme.ink }}>{title}</div>
        <div style={{ fontSize: 22 * s, color: theme.inkSoft }}>{sub}</div>
      </div>
    </div>
  );
};

export const MerchantScene2Setup: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const headO = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ padding: 70 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 * s, alignItems: "center" }}>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 78 * s, color: theme.ink, margin: 0, opacity: headO, transform: `translateY(${headY}px)`, lineHeight: 1.05, letterSpacing: -1.5, textAlign: "center" }}>
          Live in <span style={{ color: theme.teal }}>minutes</span>.
        </h2>
        <Step n={1} title="Create your merchant account" sub="Free to join — no monthly fees." appear={20} s={s} />
        <Step n={2} title="Connect Stripe in one click" sub="Get paid straight to your bank." appear={42} s={s} />
        <Step n={3} title="Turn on PawBucks acceptance" sub="Reward customers automatically." appear={64} s={s} />
      </div>
    </AbsoluteFill>
  );
};