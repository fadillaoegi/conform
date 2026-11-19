import React from "react";
import { Composition } from "remotion";
import { Intro } from "./Intro";
import { Outro, type OutroProps } from "./Outro";
import { FPS, HEIGHT, INTRO, OUTRO, WIDTH } from "./timeline";

export const Root: React.FC = () => (
  <>
    <Composition id="Intro" component={Intro} durationInFrames={INTRO.frames} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Outro" component={Outro} durationInFrames={OUTRO.frames} fps={FPS} width={WIDTH} height={HEIGHT}
      defaultProps={{ url: "" } satisfies OutroProps} />
  </>
);
