// Intro: a rush through pixel space; 26 voxels fly in from the depth and build the shared spec; the
// keystone descends on a line of light and locks; the wordmark arrives.
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, GridFloor, Overlays, Starfield } from "./Atmosphere";
import { loadFonts } from "./fonts";
import { Billboard, FloorMark, Ring, SIZE, Stage, type Camera } from "./Stage";
import { C, KEYSTONE, PIXEL, READ, STONE } from "./theme";
import { INTRO, KEY, WORD, buildOrder, flightStart } from "./timeline";
import { Voxel } from "./Voxel";

loadFonts();

const ease = Easing.bezier(0.22, 1, 0.36, 1);

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = INTRO.keyLock;

  const lockSpring = spring({ frame: frame - L, fps, config: { damping: 9, stiffness: 140 } });
  const shake = frame >= L && frame < L + 8 ? (random(`s${frame}`) - 0.5) * 18 * (1 - (frame - L) / 8) : 0;
  const slide = interpolate(frame, [INTRO.wordStart - 16, INTRO.wordStart + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const camera: Camera = {
    rotX: interpolate(frame, [0, L], [-12, -28], { extrapolateRight: "clamp", easing: ease }),
    rotY: interpolate(frame, [0, L], [-45 - 150, -45], { extrapolateRight: "clamp", easing: ease }) + Math.max(0, frame - L) * 0.06,
    x: -430 * slide + shake,
    y: 30 - 10 * slide + shake * 0.5,
    z: interpolate(frame, [0, 46, L], [-3000, -1500, -260], { extrapolateRight: "clamp", easing: ease }) - 90 * slide + 40 * (lockSpring - 1) * (frame >= L ? 1 : 0),
  };

  const flash = interpolate(frame, [L, L + 2, L + 18], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lift = frame < L ? interpolate(frame, [INTRO.keyAppear, L], [3.4, 0], { extrapolateLeft: "clamp", easing: Easing.in(Easing.cubic) }) : 0;
  const keyOpacity = interpolate(frame, [INTRO.keyAppear, INTRO.keyAppear + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const keyGlow = frame < L ? 0.3 + 0.15 * Math.sin(frame / 3) : Math.max(0.12, flash);
  const fadeOut = interpolate(frame, [INTRO.fadeStart, INTRO.frames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.void }}>
      <Audio src={staticFile("intro.wav")} />
      <AbsoluteFill style={{ opacity: fadeOut }}>
        <Backdrop />
        <Starfield rushEnd={INTRO.rushEnd} />
        <Stage camera={camera}>
          <GridFloor y={SIZE * 1.5 + 2} opacity={interpolate(frame, [30, 90], [0, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} scroll={frame * 1.5} />
          {/* The empty slot: a checkered shadow on the voxel below the keystone. */}
          <FloorMark x={KEY[0]} y={KEY[1] - 0.5 + 0.004} z={KEY[2]} size={SIZE} opacity={frame >= INTRO.keyAppear && frame < L ? 0.85 : 0}
            style={{ backgroundImage: `repeating-conic-gradient(${C.line} 0% 25%, transparent 0% 50%)`, backgroundSize: `${SIZE / 6}px ${SIZE / 6}px` }} />
          {buildOrder().map(([x, y, z], i) => {
            const start = flightStart(i);
            if (frame < start) return null;
            const p = spring({ frame: frame - start, fps, config: { damping: 13, stiffness: 105, mass: 0.85 }, durationInFrames: INTRO.flight });
            const off = [(random(`dx${i}`) - 0.5) * 16, 5 + random(`dy${i}`) * 7, -18 - random(`dz${i}`) * 10];
            const spin: [number, number, number] = [(1 - p) * 420 * (random(`a${i}`) - 0.5), (1 - p) * 300, (1 - p) * 200 * (random(`b${i}`) - 0.5)];
            return (
              <Voxel key={i} size={SIZE} color={STONE} camX={camera.rotX} camY={camera.rotY}
                pos={[x + off[0]! * (1 - p), y + off[1]! * (1 - p), z + off[2]! * (1 - p)]}
                spin={spin} scale={0.55 + 0.45 * Math.min(1, p)} glow={flash * 0.22}
                opacity={interpolate(frame, [start, start + 6], [0, 1], { extrapolateRight: "clamp" })} />
            );
          })}
          {/* The plumb line of light from the keystone to its slot. */}
          {frame >= INTRO.keyAppear && frame < L && (
            <Billboard x={KEY[0]} y={KEY[1] - 0.45} z={KEY[2]} camera={camera}>
              <div style={{ width: 6, height: Math.max(0, (lift - 0.05) * SIZE), backgroundImage: `repeating-linear-gradient(0deg, ${C.lime} 0 10px, transparent 10px 22px)`, boxShadow: `0 0 18px ${C.lime}`, opacity: keyOpacity }} />
            </Billboard>
          )}
          {frame >= INTRO.keyAppear && (
            <Voxel size={SIZE} color={KEYSTONE} camX={camera.rotX} camY={camera.rotY} pos={[KEY[0], KEY[1] + lift, KEY[2]]}
              opacity={keyOpacity} glow={keyGlow} minLight={0.82} spin={[0, frame < L ? (1 - (frame - INTRO.keyAppear) / (L - INTRO.keyAppear)) * 90 : 0, 0]} />
          )}
          <Ring progress={(frame - L) / 26} y={2.5} />
          <Ring progress={(frame - L - 6) / 30} y={2.5} color={C.cyan} />
        </Stage>
        {/* Lock flash. */}
        <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 - 22 * slide}% 46%, rgba(244,244,244,0.75) 0%, rgba(167,240,112,0.4) 12%, transparent 38%)`, opacity: flash }} />
        <Wordmark frame={frame} />
        <Overlays />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Wordmark: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const eyebrow = interpolate(frame, [INTRO.wordStart - 4, INTRO.wordStart + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tag = interpolate(frame, [INTRO.taglineStart, INTRO.taglineStart + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 830, top: 360, width: 1000 }}>
      <div style={{ fontFamily: PIXEL, fontSize: 22, letterSpacing: 4, color: C.cyan, opacity: eyebrow, transform: `translateX(${(1 - eyebrow) * 30}px)` }}>
        CONFORMANCE · BADGES · AGENTS
      </div>
      <div style={{ display: "flex", marginTop: 34 }}>
        {[...WORD].map((ch, i) => {
          const s = spring({ frame: frame - (INTRO.wordStart + i * INTRO.letterStep), fps, config: { damping: 10, stiffness: 160 } });
          return (
            <span key={i} style={{
              fontFamily: PIXEL, fontSize: 118, color: C.white, display: "inline-block", marginRight: 6,
              textShadow: `8px 8px 0 ${C.navy}, 0 0 ${30 * (1 - Math.min(1, s))}px ${C.lime}`,
              transform: `translateY(${(1 - s) * -60}px) scale(${0.4 + 0.6 * s})`, opacity: Math.min(1, s * 1.5),
            }}>{ch}</span>
          );
        })}
      </div>
      <div style={{ fontFamily: READ, fontSize: 56, lineHeight: 1.25, color: C.mist, marginTop: 40, opacity: tag, transform: `translateY(${(1 - tag) * 20}px)` }}>
        Does your agentic site<br /><span style={{ color: C.lime, fontWeight: 600 }}>speak the spec?</span>
      </div>
    </div>
  );
};
