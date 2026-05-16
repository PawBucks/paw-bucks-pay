import React from "react";
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { theme } from "./theme";
import { Backdrop } from "./components/Backdrop";
import { PaySaveScene1Hook } from "./scenes/PaySaveScene1Hook";
import { PaySaveScene2PickBill } from "./scenes/PaySaveScene2PickBill";
import { PaySaveScene3AutoApply } from "./scenes/PaySaveScene3AutoApply";
import { PaySaveScene4Confirm } from "./scenes/PaySaveScene4Confirm";
import { PaySaveScene5EarnBack } from "./scenes/PaySaveScene5EarnBack";

const display = loadDisplay("normal", { weights: ["600", "700", "800"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const fonts = {
  display: display.fontFamily,
  body: body.fontFamily,
};

const SCENE = 180; // 6s
const TRANS = 18;

export const PaySaveVideo: React.FC = () => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 1]);

  return (
    <AbsoluteFill style={{ background: theme.cream, fontFamily: body.fontFamily, color: theme.ink, overflow: "hidden" }}>
      <Backdrop drift={drift} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <PaySaveScene1Hook width={width} height={height} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <PaySaveScene2PickBill width={width} height={height} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <PaySaveScene3AutoApply width={width} height={height} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <PaySaveScene4Confirm width={width} height={height} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE + 4 * TRANS}>
          <PaySaveScene5EarnBack width={width} height={height} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};