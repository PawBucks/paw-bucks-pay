import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";
import { theme } from "../theme";
import { fonts } from "../MainVideo";
import { scale } from "../components/utils";

const Step: React.FC<{ n: number; title: string; sub: string; appear: number; s: number }> = ({ n, title, sub, appear, s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - appear, fps, config: { damping: 18, stiffness: 140 } });
  const x = interpolate(sp, [0, 1], [-60, 0]);
  const o = interpolate(frame, [appear, appear + 14], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 22 * s,
        background: "white",
        borderRadius: 22 * s,
        padding: `${20 * s}px ${28 * s}px`,
        boxShadow: "0 16px 36px rgba(15,27,45,0.10)",
        border: `1px solid ${theme.tealGlow}33`,
        transform: `translateX(${x}px)`,
        opacity: o,
        minWidth: 380 * s,
      }}
    >
      <div
        style={{
          width: 64 * s,
          height: 64 * s,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealGlow})`,
          color: "white",
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 32 * s,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {n}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30 * s, color: theme.ink }}>{title}</div>
        <div style={{ fontSize: 22 * s, color: theme.inkSoft }}>{sub}</div>
      </div>
    </div>
  );
};

export const Scene2SignUp: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);
  const portrait = height > width;

  const headO = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  const imgSp = spring({ frame: frame - 8, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill style={{ padding: 70 * s, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: portrait ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 60 * s,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22 * s, flex: 1, maxWidth: 720 * s }}>
          <h2
            style={{
              fontFamily: fonts.display,
              fontWeight: 800,
              fontSize: 78 * s,
              color: theme.ink,
              margin: 0,
              opacity: headO,
              transform: `translateY(${headY}px)`,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            Get started in <span style={{ color: theme.teal }}>60 seconds</span>.
          </h2>
          <Step n={1} title="Create your account" sub="Free. No credit card." appear={20} s={s} />
          <Step n={2} title="Add your pets" sub="Profiles, photos, and health records." appear={42} s={s} />
          <Step n={3} title="You're ready to save" sub="Welcome credit waiting in your wallet." appear={64} s={s} />
        </div>
        <div
          style={{
            transform: `scale(${interpolate(imgSp, [0, 1], [0.85, 1])}) rotate(-3deg)`,
            opacity: interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" }),
            borderRadius: 36 * s,
            overflow: "hidden",
            boxShadow: "0 30px 80px rgba(15,27,45,0.25)",
            border: `8px solid white`,
            flexShrink: 0,
          }}
        >
          <Img
            src={staticFile("images/family.png")}
            style={{ width: (portrait ? 520 : 480) * s, height: (portrait ? 520 : 600) * s, objectFit: "cover" }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};