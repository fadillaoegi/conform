// Depth: a pixel starfield rushing past, a perspective grid floor, vignette and scanlines.
import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "./theme";

export const Starfield: React.FC<{ rushEnd: number; count?: number; drift?: number }> = ({ rushEnd, count = 220, drift = 0.0025 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // Distance travelled: fast at first (the rush), then a slow drift.
  const rush = interpolate(frame, [0, rushEnd], [0, 1], { extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 });
  const travel = rush * 1.6 + Math.max(0, frame - rushEnd) * drift;
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    const sx = (random(`x${i}`) * 2 - 1) * 1.2;
    const sy = (random(`y${i}`) * 2 - 1) * 0.8;
    let z = random(`z${i}`) - travel;
    z = ((z % 1) + 1) % 1 + 0.02;
    const px = width / 2 + (sx / z) * width * 0.18;
    const py = height / 2 + (sy / z) * width * 0.18;
    if (px < -20 || px > width + 20 || py < -20 || py > height + 20) continue;
    const size = Math.max(2, Math.round((1 - z) * 7)) - ((1 - z) * 7 > 4 ? 0 : 0);
    const streak = rush < 1 ? Math.min(60, (1 - rush) * 140 * (1 - z)) : 0;
    const color = i % 7 === 0 ? C.cyan : i % 11 === 0 ? C.lime : C.mist;
    const alpha = Math.min(1, (1 - z) * 1.4) * interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
    const angle = Math.atan2(py - height / 2, px - width / 2);
    stars.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: px,
          top: py,
          width: size + streak,
          height: size,
          background: color,
          opacity: alpha,
          transformOrigin: "0 50%",
          transform: `rotate(${angle}rad)`,
          imageRendering: "pixelated",
        }}
      />,
    );
  }
  return <AbsoluteFill>{stars}</AbsoluteFill>;
};

export const GridFloor: React.FC<{ y: number; opacity: number; scroll: number }> = ({ y, opacity, scroll }) => (
  <div
    style={{
      position: "absolute",
      left: -2600,
      top: -2600,
      width: 5200,
      height: 5200,
      transform: `translate3d(0, ${y}px, 0) rotateX(90deg)`,
      backgroundImage: `linear-gradient(${C.navy} 2px, transparent 2px), linear-gradient(90deg, ${C.navy} 2px, transparent 2px)`,
      backgroundSize: "130px 130px",
      backgroundPosition: `0 ${scroll}px`,
      opacity,
      maskImage: "radial-gradient(circle at center, black 0%, rgba(0,0,0,0.6) 22%, transparent 48%)",
      WebkitMaskImage: "radial-gradient(circle at center, black 0%, rgba(0,0,0,0.6) 22%, transparent 48%)",
    }}
  />
);

export const Overlays: React.FC = () => (
  <>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)" }} />
    <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 2px, transparent 2px 4px)", mixBlendMode: "multiply" }} />
  </>
);

export const Backdrop: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 55%, ${C.ink} 0%, ${C.line} 55%, ${C.void} 100%)` }} />
);
