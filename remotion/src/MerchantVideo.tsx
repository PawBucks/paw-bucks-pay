import React from "react";
import { AbsoluteFill, Audio, staticFile, useVideoConfig, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { theme } from "./theme";
import { Backdrop } from "./components/Backdrop";
import { MerchantScene1Hook } from "./scenes/MerchantScene1Hook";
import { MerchantScene2Setup } from "./scenes/MerchantScene2Setup";
import { MerchantScene3Dashboard } from "./scenes/MerchantScene3Dashboard";
import { MerchantScene4Wallet } from "./scenes/MerchantScene4Wallet";
import { MerchantScene5CTA } from "./scenes/MerchantScene5CTA";

const display = loadDisplay("normal", { weights: ["600", "700", "800"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const fonts = {
  display: display.fontFamily,
  body: body.fontFamily,
};

const SCENE = 180;
const TRANS = 18;

const SceneFrame: React.FC<{ index: number; title: string; children: React.ReactNode }> = ({ index, title, children }) => {
  const frame = useCurrentFrame();
  const start = (index - 1) * 6;
  const end = index * 6;
  const fmt = (s: number) => `0:${String(s).padStart(2, "0")}`;
  const o = interpolate(frame, [4, 16, SCENE - 16, SCENE - 4], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <Audio src={staticFile(`audio/merchant${index}.mp3`)} volume={0.95} />
      {children}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: "4%",
            left: "50%",
            transform: "translateX(-50%)",
            opacity: o,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(255,255,255,0.92)",
            border: `1px solid ${theme.teal}33`,
            borderRadius: 999,
            padding: "10px 20px",
            boxShadow: "0 8px 24px rgba(15,27,45,0.08)",
            fontFamily: body.fontFamily,
            fontSize: 22,
            color: theme.ink,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: theme.teal, fontWeight: 800 }}>0{index}</span>
          <span style={{ color: theme.inkSoft }}>·</span>
          <span>{title}</span>
          <span style={{ color: theme.inkSoft }}>·</span>
          <span style={{ fontVariantNumeric: "tabular-nums", color: theme.tealDeep }}>{fmt(start)}–{fmt(end)}</span>
        </div>
      </AbsoluteFill>
    </>
  );
};

export const MerchantVideo: React.FC = () => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 1]);

  return (
    <AbsoluteFill style={{ background: theme.cream, fontFamily: body.fontFamily, color: theme.ink, overflow: "hidden" }}>
      <Backdrop drift={drift} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={1} title="Loyal regulars">
            <MerchantScene1Hook width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={2} title="Set up fast">
            <MerchantScene2Setup width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={3} title="Live dashboard">
            <MerchantScene3Dashboard width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={4} title="Rewards Wallet">
            <MerchantScene4Wallet width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE + 4 * TRANS}>
          <SceneFrame index={5} title="Become a partner">
            <MerchantScene5CTA width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};