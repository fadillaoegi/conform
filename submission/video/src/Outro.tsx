// Closing: the nine top voxels light up one by one (C1 to C9), the keystone nods and locks again, and
// the line "Check before you trust." lands with the lockup.
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, GridFloor, Overlays, Starfield } from "./Atmosphere";
import { loadFonts } from "./fonts";
import { Billboard, Ring, SIZE, Stage, type Camera } from "./Stage";
import { C, KEYSTONE, LIT, PIXEL, READ, STONE } from "./theme";
import { KEY, N, OUTRO, checkFrame, topCells } from "./timeline";
import { Voxel } from "./Voxel";

loadFonts();

const ease = Easing.bezier(0.22, 1, 0.36, 1);

export type OutroProps = {
  /** Public address of the site, shown under the lockup when set. */
  url: string;
};

export const Outro: React.FC<OutroProps> = ({ url }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const H = OUTRO.hopLock;
  const flash = interpolate(frame, [H, H + 2, H + 16], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const camera: Camera = {
    rotX: -26 + 3 * Math.sin(frame / 40),
    rotY: -45 + 22 * Math.sin(frame / 55) - interpolate(frame, [0, 40], [40, 0], { extrapolateRight: "clamp", easing: ease }),
    x: -430,
    y: 40,
    z: interpolate(frame, [0, 40], [-900, -300], { extrapolateRight: "clamp", easing: ease }),
  };
  const fadeIn = interpolate(frame, [0, OUTRO.fadeIn], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [OUTRO.fadeStart, OUTRO.frames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cells = topCells();
  const litIndex = (x: number, y: number, z: number) => cells.findIndex((c) => c[0] === x && c[1] === y && c[2] === z);
  // The keystone's nod: it rises and locks again.
  const hop = frame < OUTRO.hopStart ? 0 : frame < H
    ? Math.sin(((frame - OUTRO.hopStart) / (H - OUTRO.hopStart)) * Math.PI) * 1.4
    : 0;

  const voxels = [];
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      for (let z = 0; z < N; z += 1) {
        const isKey = x === KEY[0] && y === KEY[1] && z === KEY[2];
        const n = litIndex(x, y, z);
        const since = n >= 0 ? frame - checkFrame(n) : -1;
        const lit = since >= 0;
        const pulse = lit ? interpolate(since, [0, 3, 18], [0, 1, 0.15], { extrapolateRight: "clamp" }) : 0;
        voxels.push(
          <Voxel key={`${x}${y}${z}`} size={SIZE} camX={camera.rotX} camY={camera.rotY}
            color={isKey ? KEYSTONE : lit ? LIT : STONE} minLight={isKey || lit ? 0.78 : 0}
            pos={[x, y + (isKey ? hop : 0) + (lit ? 0.12 * pulse : 0), z]}
            glow={Math.max(pulse, isKey ? flash : flash * 0.2)} />,
        );
      }
    }
  }

  return (
    <AbsoluteFill style={{ background: C.void }}>
      <Audio src={staticFile("outro.wav")} />
      <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
        <Backdrop />
        <Starfield rushEnd={1} drift={0.004} />
        <Stage camera={camera}>
          <GridFloor y={SIZE * 1.5 + 2} opacity={0.5} scroll={frame * 1.2} />
          {voxels}
          {cells.map(([x, y, z], n) => {
            const since = frame - checkFrame(n);
            if (since < 0 || since > 26) return null;
            return (
              <Billboard key={n} x={x} y={y + 0.9 + since * 0.03} z={z} camera={camera}
                style={{ fontFamily: PIXEL, fontSize: 30, color: C.lime, textShadow: `4px 4px 0 ${C.line}`, opacity: interpolate(since, [0, 4, 18, 26], [0, 1, 1, 0]) }}>
                C{n + 1}
              </Billboard>
            );
          })}
          <Ring progress={(frame - H) / 26} y={2.5} />
        </Stage>
        <AbsoluteFill style={{ background: "radial-gradient(circle at 28% 46%, rgba(244,244,244,0.8) 0%, rgba(167,240,112,0.4) 16%, transparent 45%)", opacity: flash }} />
        <RightColumn frame={frame} fps={fps} url={url} />
        <Overlays />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const RightColumn: React.FC<{ frame: number; fps: number; url: string }> = ({ frame, fps, url }) => {
  const hud = interpolate(frame, [OUTRO.checkStart - 12, OUTRO.checkStart], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line = spring({ frame: frame - OUTRO.textStart, fps, config: { damping: 14, stiffness: 120 } });
  const lock = spring({ frame: frame - OUTRO.lockupStart, fps, config: { damping: 14, stiffness: 110 } });
  const sub = interpolate(frame, [OUTRO.lockupStart + 10, OUTRO.lockupStart + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 830, top: 250, width: 1000 }}>
      <div style={{ display: "flex", gap: 10, opacity: hud }}>
        {Array.from({ length: 9 }, (_, n) => {
          const on = frame >= checkFrame(n);
          return (
            <div key={n} style={{
              width: 96, height: 74, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: PIXEL, fontSize: 20, color: on ? C.ink : C.slate,
              background: on ? C.green : C.line, boxShadow: on ? `inset 0 -8px 0 rgba(0,0,0,0.25), 0 0 18px rgba(167,240,112,0.35)` : `inset 0 0 0 4px ${C.night}`,
            }}>C{n + 1}</div>
          );
        })}
      </div>
      <div style={{ fontFamily: PIXEL, fontSize: 50, lineHeight: 1.5, color: C.yellow, marginTop: 70, opacity: Math.min(1, line), transform: `translateX(${(1 - line) * 60}px)` }}>
        Check before<br />you trust.
      </div>
      <div style={{ marginTop: 60, opacity: Math.min(1, lock), transform: `translateY(${(1 - lock) * 30}px)` }}>
        <div style={{ fontFamily: PIXEL, fontSize: 84, color: C.white, textShadow: `7px 7px 0 ${C.navy}` }}>CONFORM</div>
        <div style={{ fontFamily: READ, fontSize: 40, color: C.mist, marginTop: 24, opacity: sub }}>Conformance for the open agentic web</div>
        <div style={{ fontFamily: READ, fontSize: 30, color: C.slate, marginTop: 14, opacity: sub }}>
          {url ? <span style={{ color: C.cyan }}>{url}</span> : null}{url ? "  ·  " : ""}Open source · Apache-2.0
        </div>
      </div>
    </div>
  );
};
