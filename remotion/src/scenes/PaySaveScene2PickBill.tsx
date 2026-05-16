import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { theme } from "../theme";
import { fonts } from "../PaySaveVideo";
import { scale } from "../components/utils";

const BILLS = [
  { icon: "🩺", label: "Riverdale Vet Clinic", sub: "Wellness visit", amt: "$148.00" },
  { icon: "✂️", label: "Happy Tails Grooming", sub: "Full groom", amt: "$95.00", picked: true },
  { icon: "🦴", label: "Bark & Bone Market", sub: "Food + treats", amt: "$62.40" },
];

export const PaySaveScene2PickBill: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = scale(width, height);

  const stepO = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const headO = interpolate(frame, [6, 24], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame: frame - 6, fps, config: { damping: 22 } }), [0, 1], [30, 0]);

  const pulse = 1 + Math.sin(Math.max(0, frame - 120) * 0.18) * 0.025;

  return (
    <AbsoluteFill style={{ padding: 60 * s, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 * s, width: "100%", maxWidth: 1100 * s }}>
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
          Pick <span style={{ color: theme.teal }}>any bill</span> to pay.
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 * s, width: "94%" }}>
          {BILLS.map((b, i) => {
            const start = 40 + i * 18;
            const sp = spring({ frame: frame - start, fps, config: { damping: 18 } });
            const y = interpolate(sp, [0, 1], [50, 0]);
            const o = interpolate(frame, [start, start + 20], [0, 1], { extrapolateRight: "clamp" });
            const picked = b.picked;
            const pickScale = picked ? pulse : 1;
            return (
              <div
                key={i}
                style={{
                  opacity: o,
                  transform: `translateY(${y}px) scale(${pickScale})`,
                  background: "white",
                  borderRadius: 24 * s,
                  padding: `${24 * s}px ${28 * s}px`,
                  boxShadow: picked ? `0 24px 56px ${theme.teal}44` : "0 10px 24px rgba(15,27,45,0.08)",
                  border: picked ? `2px solid ${theme.teal}` : `1px solid ${theme.ink}11`,
                  display: "flex",
                  alignItems: "center",
                  gap: 22 * s,
                }}
              >
                <div
                  style={{
                    width: 64 * s,
                    height: 64 * s,
                    borderRadius: 18 * s,
                    background: picked ? `linear-gradient(135deg, ${theme.teal}, ${theme.tealDeep})` : `${theme.teal}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 36 * s,
                  }}
                >
                  {b.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30 * s, color: theme.ink }}>{b.label}</div>
                  <div style={{ fontSize: 22 * s, color: theme.inkSoft, marginTop: 4 * s }}>{b.sub}</div>
                </div>
                <div
                  style={{
                    fontFamily: fonts.display,
                    fontWeight: 800,
                    fontSize: 30 * s,
                    color: picked ? theme.tealDeep : theme.ink,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {b.amt}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};