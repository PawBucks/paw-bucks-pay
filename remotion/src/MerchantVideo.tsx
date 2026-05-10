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

const SceneFrame: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
  return (
    <>
      <Audio src={staticFile(`audio/merchant${index}.mp3`)} volume={0.95} />
      {children}
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
          <SceneFrame index={1}>
            <MerchantScene1Hook width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={2}>
            <MerchantScene2Setup width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={3}>
            <MerchantScene3Dashboard width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={4}>
            <MerchantScene4Wallet width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE + 4 * TRANS}>
          <SceneFrame index={5}>
            <MerchantScene5CTA width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};