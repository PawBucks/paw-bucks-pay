import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

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
    </>
  );
};