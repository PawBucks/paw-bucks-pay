import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PurchaseVideo";
import { scale } from "../components/utils";
import { Paw } from "../components/Paw";

const MERCHANTS = [
  { name: "Happy Tails Grooming", tag: "Grooming · 0.4 mi", rate: "20%" },
  { name: "Riverdale Vet Clinic", tag: "Vet · 0.7 mi", rate: "15%" },
  { name: "Bark & Bone Cafe", tag: "Treats · 1.1 mi", rate: "10%" },
];

export const PurchaseScene2FindMerchant: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const stepO = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const headO = interpolate(frame, [6, 24], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame: frame - 6, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  // Search bar typing effect
  const text = "grooming near me";
  const chars = Math.floor(interpolate(frame, [30, 80], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const typed = text.slice(0, chars);

  // Pin pulse
  const pulse = 1 + Math.sin(frame * 0.15) * 0.08;

  return (
    <AbsoluteFill style={{ padding: 60 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 * s, width: "100%", maxWidth: 1100 * s }}>
        <div style={{ opacity: stepO, fontSize: 22 * s, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: theme.tealDeep }}>
          Step 1
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
          Find a <span style={{ color: theme.teal }}>partner merchant</span>.
        </h2>

        {/* Search bar */}
        <div
          style={{
            background: "white",
            borderRadius: 999,
            padding: `${18 * s}px ${30 * s}px`,
            boxShadow: "0 18px 40px rgba(15,27,45,0.10)",
            border: `2px solid ${theme.teal}33`,
            display: "flex",
            alignItems: "center",
            gap: 16 * s,
            width: "92%",
            fontSize: 30 * s,
          }}
        >
          <span style={{ color: theme.teal, fontSize: 32 * s }}>🔍</span>
          <span style={{ color: theme.ink, fontWeight: 600, fontFamily: fonts.body }}>
            {typed}
            <span style={{ opacity: Math.sin(frame * 0.4) > 0 ? 1 : 0, color: theme.teal }}>|</span>
          </span>
        </div>

        {/* Merchant cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 * s, width: "92%" }}>
          {MERCHANTS.map((m, i) => {
            const cardSp = spring({ frame: frame - (80 + i * 14), fps, config: { damping: 18 } });
            const cardY = interpolate(cardSp, [0, 1], [40, 0]);
            const cardO = interpolate(frame, [80 + i * 14, 100 + i * 14], [0, 1], { extrapolateRight: "clamp" });
            const isFirst = i === 0;
            return (
              <div
                key={i}
                style={{
                  opacity: cardO,
                  transform: `translateY(${cardY}px) ${isFirst ? `scale(${pulse})` : ""}`,
                  background: "white",
                  borderRadius: 24 * s,
                  padding: `${22 * s}px ${28 * s}px`,
                  boxShadow: isFirst ? `0 22px 50px ${theme.teal}33` : "0 10px 24px rgba(15,27,45,0.08)",
                  border: isFirst ? `2px solid ${theme.teal}` : `1px solid ${theme.ink}11`,
                  display: "flex",
                  alignItems: "center",
                  gap: 20 * s,
                }}
              >
                <div
                  style={{
                    width: 60 * s,
                    height: 60 * s,
                    borderRadius: 18 * s,
                    background: `linear-gradient(135deg, ${theme.teal}, ${theme.tealDeep})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Paw size={32 * s} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30 * s, color: theme.ink }}>{m.name}</div>
                  <div style={{ fontSize: 22 * s, color: theme.inkSoft, marginTop: 4 * s }}>{m.tag}</div>
                </div>
                <div
                  style={{
                    background: theme.teal,
                    color: "white",
                    borderRadius: 999,
                    padding: `${8 * s}px ${18 * s}px`,
                    fontWeight: 700,
                    fontSize: 22 * s,
                  }}
                >
                  Earn {m.rate}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};