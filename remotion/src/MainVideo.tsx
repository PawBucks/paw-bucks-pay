import React from "react";
import { AbsoluteFill, Audio, staticFile, useVideoConfig, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { theme } from "./theme";
import { Backdrop } from "./components/Backdrop";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2SignUp } from "./scenes/Scene2SignUp";
import { Scene3Earn } from "./scenes/Scene3Earn";
import { Scene4Save } from "./scenes/Scene4Save";
import { Scene5CTA } from "./scenes/Scene5CTA";

const display = loadDisplay("normal", { weights: ["600", "700", "800"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const fonts = {
  display: display.fontFamily,
  body: body.fontFamily,
};

const SCENE = 180; // 6s each
const TRANS = 18; // 0.6s

const SceneFrame: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
  return (
    <>
      <Audio src={staticFile(`audio/scene${index}.mp3`)} volume={0.95} />
      {children}
    </>
  );
};

export const MainVideo: React.FC = () => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  // Subtle drifting background animation across full duration
  const drift = interpolate(frame, [0, 900], [0, 1]);

  return (
    <AbsoluteFill style={{ background: theme.cream, fontFamily: fonts.body, color: theme.ink, overflow: "hidden" }}>
      <Backdrop drift={drift} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={1}>
            <Scene1Hook width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={2}>
            <Scene2SignUp width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={3}>
            <Scene3Earn width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <SceneFrame index={4}>
            <Scene4Save width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE + 4 * TRANS}>
          <SceneFrame index={5}>
            <Scene5CTA width={width} height={height} />
          </SceneFrame>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};