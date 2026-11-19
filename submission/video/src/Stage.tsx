// The 3D stage: perspective, a camera transform, and helpers placed in grid space.
import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "./theme";

export const SIZE = 118;

export interface Camera {
  rotX: number;
  rotY: number;
  x: number;
  y: number;
  z: number;
}

export const Stage: React.FC<{ camera: Camera; children: React.ReactNode }> = ({ camera, children }) => (
  <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: "50% 46%" }}>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transformStyle: "preserve-3d",
        transform: `translate3d(${camera.x}px, ${camera.y}px, ${camera.z}px) rotateX(${camera.rotX}deg) rotateY(${camera.rotY}deg)`,
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

/** Grid position (cube centered at origin, y up) to stage pixels. */
export function px(x: number, y: number, z: number, size = SIZE): string {
  return `translate3d(${(x - 1) * size}px, ${-(y - 1) * size}px, ${(z - 1) * size}px)`;
}

/** A flat element lying on a horizontal plane at grid height y (a top surface). */
export const FloorMark: React.FC<{ x: number; y: number; z: number; size: number; opacity: number; style?: React.CSSProperties }> = ({ x, y, z, size, opacity, style }) => (
  <div
    style={{
      position: "absolute",
      left: -size / 2,
      top: -size / 2,
      width: size,
      height: size,
      transform: `${px(x, y, z)} rotateX(90deg)`,
      opacity,
      ...style,
    }}
  />
);

/** A shockwave ring on the top surface of the cube. */
export const Ring: React.FC<{ progress: number; y: number; color?: string }> = ({ progress, y, color = C.lime }) => {
  if (progress <= 0 || progress >= 1) return null;
  const d = SIZE * (0.6 + progress * 5.5);
  return (
    <div
      style={{
        position: "absolute",
        left: -d / 2,
        top: -d / 2,
        width: d,
        height: d,
        borderRadius: "50%",
        border: `${Math.max(3, 14 * (1 - progress))}px solid ${color}`,
        boxShadow: `0 0 ${40 * (1 - progress)}px ${color}`,
        transform: `${px(1, y, 1)} rotateX(90deg)`,
        opacity: (1 - progress) ** 1.2,
      }}
    />
  );
};

/** A billboard (always facing the camera) at a grid position. */
export const Billboard: React.FC<{ x: number; y: number; z: number; camera: Camera; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, z, camera, children, style }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      transformStyle: "preserve-3d",
      transform: `${px(x, y, z)} rotateY(${-camera.rotY}deg) rotateX(${-camera.rotX}deg)`,
    }}
  >
    <div style={{ position: "absolute", transform: "translate(-50%, -100%)", ...style }}>{children}</div>
  </div>
);
