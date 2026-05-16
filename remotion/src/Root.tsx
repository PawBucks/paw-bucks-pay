import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { MerchantVideo } from "./MerchantVideo";
import { PurchaseVideo } from "./PurchaseVideo";

const FPS = 30;
const DURATION = 30 * FPS; // 900 frames, 30s

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="horizontal"
        component={MainVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="vertical"
        component={MainVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="square"
        component={MainVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="merchant-horizontal"
        component={MerchantVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="merchant-vertical"
        component={MerchantVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="merchant-square"
        component={MerchantVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="purchase-horizontal"
        component={PurchaseVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="purchase-vertical"
        component={PurchaseVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="purchase-square"
        component={PurchaseVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
    </>
  );
};