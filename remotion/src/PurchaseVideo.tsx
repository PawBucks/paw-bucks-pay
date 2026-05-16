import React from "react";
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { theme } from "./theme";
import { Backdrop } from "./components/Backdrop";
import { PurchaseScene1Open } from "./scenes/PurchaseScene1Open";
import { PurchaseScene2FindMerchant } from "./scenes/PurchaseScene2FindMerchant";
import { PurchaseScene3Checkout } from "./scenes/PurchaseScene3Checkout";
import { PurchaseScene4ApplyPawBucks } from "./scenes/PurchaseScene4ApplyPawBucks";
import { PurchaseScene5Done } from "./scenes/PurchaseScene5Done";

const display = loadDisplay("normal", { weights: ["600", "700", "800"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const fonts = {
  display: display.fontFamily,
  body: body.fontFamily,
};

const SCENE = 180; // 6s
const TRANS = 18;

export const PurchaseVideo: React.FC = () => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 1]);

  return (
    <AbsoluteFill style={{ background: theme.cream, fontFamily: body.fontFamily, color: theme.ink, overflow: "hidden" }}>
      <Backdrop drift={drift} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <PurchaseScene1Open width={width} height={height} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <PurchaseScene2FindMerchant width={width} height={height} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <PurchaseScene3Checkout width={width} height={height} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE}>
          <PurchaseScene4ApplyPawBucks width={width} height={height} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS })} />
        <TransitionSeries.Sequence durationInFrames={SCENE + 4 * TRANS}>
          <PurchaseScene5Done width={width} height={height} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};