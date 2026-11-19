// One voxel in CSS 3D, lit per face from the camera's current rotation, so it reads as a solid as it turns.
import React from "react";

type Vec = [number, number, number];

const FACES: Array<{ name: string; normal: Vec; transform: (h: number) => string }> = [
  { name: "front", normal: [0, 0, 1], transform: (h) => `translateZ(${h}px)` },
  { name: "back", normal: [0, 0, -1], transform: (h) => `rotateY(180deg) translateZ(${h}px)` },
  { name: "right", normal: [1, 0, 0], transform: (h) => `rotateY(90deg) translateZ(${h}px)` },
  { name: "left", normal: [-1, 0, 0], transform: (h) => `rotateY(-90deg) translateZ(${h}px)` },
  { name: "top", normal: [0, -1, 0], transform: (h) => `rotateX(90deg) translateZ(${h}px)` },
  { name: "bottom", normal: [0, 1, 0], transform: (h) => `rotateX(-90deg) translateZ(${h}px)` },
];

// Light from the upper left, slightly toward the viewer (CSS axes: y points down).
const LIGHT: Vec = (() => {
  const v: Vec = [-0.45, -0.8, 0.55];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

function rotate(n: Vec, rotXDeg: number, rotYDeg: number): Vec {
  const ry = (rotYDeg * Math.PI) / 180, rx = (rotXDeg * Math.PI) / 180;
  // CSS: transform: rotateX(rx) rotateY(ry) applies rotateY first.
  const x1 = n[0] * Math.cos(ry) + n[2] * Math.sin(ry);
  const z1 = -n[0] * Math.sin(ry) + n[2] * Math.cos(ry);
  const y1 = n[1];
  const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);
  return [x1, y2, z2];
}

function hex(c: string): Vec {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(base: string, f: number, glow: number): string {
  const [r, g, b] = hex(base);
  const k = Math.max(0, Math.min(1.25, f));
  const mix = (v: number) => Math.round(Math.min(255, v * k + (255 - v * k) * glow * 0.35));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export interface VoxelProps {
  size: number;
  /** Position in grid units, cube centered at the origin; y is up. */
  pos: Vec;
  color: string;
  camX: number;
  camY: number;
  opacity?: number;
  /** 0..1 extra light (lit checks, the lock flash). */
  glow?: number;
  /** Extra spin while flying, degrees. */
  spin?: Vec;
  scale?: number;
  /** Minimum light on every face, so an emissive voxel (the keystone) never looks dull. */
  minLight?: number;
}

export const Voxel: React.FC<VoxelProps> = ({ size, pos, color, camX, camY, opacity = 1, glow = 0, spin = [0, 0, 0], scale = 1, minLight = 0 }) => {
  const h = size / 2;
  const [x, y, z] = pos;
  const bevel = Math.max(2, Math.round(size * 0.07));
  return (
    <div
      style={{
        position: "absolute",
        left: -h,
        top: -h,
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        transform: `translate3d(${(x - 1) * size}px, ${-(y - 1) * size}px, ${(z - 1) * size}px) rotateX(${spin[0]}deg) rotateY(${spin[1]}deg) rotateZ(${spin[2]}deg) scale3d(${scale}, ${scale}, ${scale})`,
        opacity,
      }}
    >
      {FACES.map((face) => {
        const n = rotate(face.normal, camX, camY + spin[1]);
        const lambert = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        const f = Math.max(minLight, 0.42 + 0.78 * lambert);
        const fill = shade(color, f, glow);
        const edge = shade(color, f * 0.55, 0);
        const hi = shade(color, f * 1.18, glow);
        return (
          <div
            key={face.name}
            style={{
              position: "absolute",
              inset: 0,
              background: fill,
              transform: face.transform(h),
              backfaceVisibility: "hidden",
              boxShadow: `inset 0 0 0 ${bevel}px ${edge}, inset ${bevel * 2}px ${bevel * 2}px 0 -${bevel}px ${hi}`,
            }}
          />
        );
      })}
    </div>
  );
};
