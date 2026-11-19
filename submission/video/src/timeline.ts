// One timeline for picture and sound: scripts/make-audio.mjs imports this file, so every sound lands on
// the frame of the event it belongs to.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const N = 3;
/** The keystone: front-top corner of the 3×3×3 cube (x right, y up, z toward the viewer). */
export const KEY: [number, number, number] = [2, 2, 2];

export const INTRO = {
  frames: 240,
  rushEnd: 54,
  buildStart: 16,
  buildStep: 2.6,
  flight: 24,
  keyAppear: 100,
  keyLock: 132,
  wordStart: 150,
  letterStep: 3,
  taglineStart: 176,
  fadeStart: 222,
} as const;

export const OUTRO = {
  frames: 240,
  fadeIn: 14,
  checkStart: 26,
  checkStep: 10,
  hopStart: 122,
  hopLock: 140,
  textStart: 146,
  lockupStart: 170,
  fadeStart: 222,
} as const;

/** Every voxel except the keystone, in build order: bottom layer first, back to front. */
export function buildOrder(): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let y = 0; y < N; y += 1) {
    const layer: Array<[number, number, number]> = [];
    for (let x = 0; x < N; x += 1) {
      for (let z = 0; z < N; z += 1) {
        if (x === KEY[0] && y === KEY[1] && z === KEY[2]) continue;
        layer.push([x, y, z]);
      }
    }
    layer.sort((a, b) => a[0] + a[2] - (b[0] + b[2]) || a[0] - b[0]);
    out.push(...layer);
  }
  return out;
}

/** Frame at which voxel number `index` in build order starts flying in, and lands. */
export function flightStart(index: number): number {
  return INTRO.buildStart + index * INTRO.buildStep;
}
export function landFrame(index: number): number {
  return flightStart(index) + INTRO.flight;
}

/** The nine top voxels, C1 to C9, in reading order (back row first). */
export function topCells(): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let z = 0; z < N; z += 1) for (let x = 0; x < N; x += 1) out.push([x, N - 1, z]);
  return out;
}
export function checkFrame(n: number): number {
  return OUTRO.checkStart + n * OUTRO.checkStep;
}

export const WORD = "CONFORM";
