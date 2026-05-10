import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "../theme";
import { Paw } from "./Paw";

export const Backdrop: React.FC<{ drift: number }> = ({ drift }) => {
  const a = drift * 60;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(900px at ${30 + a * 0.4}% ${20 + a * 0.2}%, ${theme.tealGlow}55 0%, transparent 60%),
                       radial-gradient(700px at ${80 - a * 0.3}% ${85 - a * 0.4}%, ${theme.gold}33 0%, transparent 55%),
                       linear-gradient(135deg, ${theme.cream}, #ffffff 50%, ${theme.cream})`,
        }}
      />
      {/* Soft floating paw motifs */}
      {[
        { x: 6, y: 12, s: 110, o: 0.07 },
        { x: 88, y: 18, s: 140, o: 0.08 },
        { x: 12, y: 80, s: 170, o: 0.06 },
        { x: 82, y: 72, s: 90, o: 0.07 },
      ].map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: `translate(${Math.sin(drift * Math.PI * 2 + i) * 12}px, ${Math.cos(drift * Math.PI * 2 + i) * 10}px) rotate(${i * 18 - 30}deg)`,
          }}
        >
          <Paw size={p.s} color={theme.teal} opacity={p.o} />
        </div>
      ))}
    </AbsoluteFill>
  );
};