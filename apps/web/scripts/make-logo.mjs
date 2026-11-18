// Generates Conform's logo as true pixel art: isometric voxels rasterized onto a pixel grid (2:1 lines),
// written as SVG rects with crisp edges. Run: node apps/web/scripts/make-logo.mjs
//
// "The Keystone": a 3×3×3 cube of identical voxels (the shared spec; three axes for its three tenets)
// with its front-top voxel lifted above its own slot, lit green and marked with a check: a site that
// has exactly the right shape, verified before it is trusted, never forced in.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/brand");

// Sweetie 16.
const C = {
  line: "#0d0e16", ink: "#1a1c2c", night: "#333c57", navy: "#29366f", blue: "#3b5dc9", sky: "#41a6f6",
  cyan: "#73eff7", white: "#f4f4f4", mist: "#94b0c2", slate: "#566c86", lime: "#a7f070", green: "#38b764", teal: "#257179",
};
const STONE = { top: C.blue, topEdge: C.sky, left: C.navy, leftEdge: C.navy, right: C.night, rightEdge: C.night };
// The cube's front vertical edge catches the light once; the sides stay a calm monolith.
const STONE_FRONT = { ...STONE, frontEdge: C.sky };
const KEY = { top: C.lime, topEdge: C.white, left: C.green, leftEdge: C.lime, right: C.teal, rightEdge: C.green };

const A = 8; // half the voxel's screen width: a voxel is 16 px wide, its top face 16×8.
const N = 3;

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }
  set(x, y, c) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null;
  }
}

/** Draw one voxel sprite with its top-left bounding corner at (ox, oy). */
function voxel(cv, ox, oy, pal) {
  // Integer pixel-art iso cube, 2a wide, 2a+1 tall: top diamond rows 0..a-1, sides below.
  for (let y = 0; y < 2 * A; y += 1) {
    for (let x = 0; x < 2 * A; x += 1) {
      const cx = x < A ? A - 1 - x : x - A; // 0 at the centre column pair
      const halfRow = Math.floor((A - 1 - cx) / 2); // 2:1 slope: tallest at the centre
      const topStart = A / 2 - 1 - halfRow;          // first row of the top face in this column
      const topEnd = A / 2 + halfRow;                // last row of the top face
      if (y >= topStart && y <= topEnd) {
        const edge = y === topStart;
        cv.set(ox + x, oy + y, edge ? pal.topEdge : pal.top);
      } else if (y > topEnd && y <= topEnd + A) {
        const left = x < A;
        let face = left ? (x === 0 ? pal.leftEdge : pal.left) : (x === 2 * A - 1 ? pal.rightEdge : pal.right);
        if (pal.frontEdge && x === A - 1) face = pal.frontEdge;
        cv.set(ox + x, oy + y, face);
      }
    }
  }
}

function project(i, j, k, ox, oy) {
  return { x: ox + (i - j) * A, y: oy + (i + j) * (A / 2) - k * A };
}

function outline(cv, color) {
  const add = [];
  for (let y = 0; y < cv.h; y += 1) {
    for (let x = 0; x < cv.w; x += 1) {
      if (cv.get(x, y)) continue;
      if (cv.get(x - 1, y) || cv.get(x + 1, y) || cv.get(x, y - 1) || cv.get(x, y + 1)) add.push([x, y]);
    }
  }
  for (const [x, y] of add) cv.set(x, y, color);
}

function mark() {
  const W = 3 * 2 * A + 4, H = 3 * 2 * A + 22;
  const cv = new Canvas(W, H);
  const ox = W / 2 - A, oy = 18 + 2 * A;
  const voxels = [];
  for (let i = 0; i < N; i += 1) for (let j = 0; j < N; j += 1) for (let k = 0; k < N; k += 1) voxels.push([i, j, k]);
  const keystone = [N - 1, N - 1, N - 1];
  const isKey = (v) => v[0] === keystone[0] && v[1] === keystone[1] && v[2] === keystone[2];
  voxels.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[2] - b[2] || a[0] - b[0]);
  for (const v of voxels) {
    if (isKey(v)) continue;
    const p = project(v[0], v[1], v[2], ox, oy);
    voxel(cv, p.x, p.y, v[0] === N - 1 && v[1] === N - 1 ? STONE_FRONT : STONE);
  }
  // The empty slot: a soft shadow where the keystone will land.
  const slot = project(...keystone, ox, oy);
  for (let y = 0; y < A; y += 1) {
    for (let x = 0; x < 2 * A; x += 1) {
      const cx = x < A ? A - 1 - x : x - A;
      const half = Math.floor((A - 1 - cx) / 2);
      if (y >= A / 2 - 1 - half && y <= A / 2 + half && (x + y) % 2 === 0) cv.set(slot.x + x, slot.y + A + y, C.line);
    }
  }
  outline(cv, C.line);
  // Guide: two lime pixels between slot and keystone, aligned with the slot's centre.
  const lift = 14;
  // Guide: a dotted plumb line of light from the keystone to the centre of its slot.
  cv.set(slot.x + A - 1, slot.y + A + 1, C.lime);
  cv.set(slot.x + A - 1, slot.y + A - 2, C.green);
  cv.set(slot.x + A - 1, slot.y + A - 5, C.teal);
  // The keystone, lifted above its slot.
  const kc = new Canvas(W, H);
  voxel(kc, slot.x, slot.y - lift, KEY);
  outline(kc, C.line);
  // A small check mark carved into its top face.
  const t = { x: slot.x + A - 3, y: slot.y - lift + 2 };
  for (const [dx, dy] of [[0, 1], [1, 2], [2, 3], [3, 2], [4, 1], [5, 0]]) kc.set(t.x + dx, t.y + dy, C.ink);
  for (let i = 0; i < kc.px.length; i += 1) if (kc.px[i]) cv.px[i] = kc.px[i];
  return cv;
}

// A 5×7 pixel font for the wordmark.
const FONT = {
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
};

function wordmark(text, color, shadow) {
  const cv = new Canvas(text.length * 6 + 1, 9);
  [...text].forEach((ch, n) => FONT[ch].forEach((row, y) => [...row].forEach((b, x) => {
    if (b === "1") {
      cv.set(n * 6 + x + 1, y + 1, shadow);
      cv.set(n * 6 + x, y, color);
    }
  })));
  return cv;
}

/** Merge each row's runs of one color into rects. */
function rects(cv, dx = 0, dy = 0) {
  let out = "";
  for (let y = 0; y < cv.h; y += 1) {
    let x = 0;
    while (x < cv.w) {
      const c = cv.get(x, y);
      if (!c) { x += 1; continue; }
      let end = x;
      while (end + 1 < cv.w && cv.get(end + 1, y) === c) end += 1;
      out += `<rect x="${x + dx}" y="${y + dy}" width="${end - x + 1}" height="1" fill="${c}"/>`;
      x = end + 1;
    }
  }
  return out;
}

function svg(w, h, body, { title, bg } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 8}" height="${h * 8}" shape-rendering="crispEdges" role="img" aria-label="${title}">
<title>${title}</title>
${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}${body}
</svg>
`;
}

const m = mark();
const word = wordmark("CONFORM", C.white, C.navy);
await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "conform-mark.svg"), svg(m.w, m.h, rects(m), { title: "Conform" }));
await writeFile(path.join(OUT, "conform-mark-dark.svg"), svg(m.w + 8, m.h + 8, rects(m, 4, 4), { title: "Conform", bg: C.ink }));
const gap = 6;
const LW = m.w + gap + word.w + 4, LH = m.h;
const wy = Math.round(LH / 2 - 4);
await writeFile(path.join(OUT, "conform-lockup.svg"), svg(LW + 8, LH + 8, rects(m, 4, 4) + rects(word, 4 + m.w + gap, 4 + wy), { title: "Conform", bg: C.ink }));
// The site uses the same mark in its header and as its favicon.
const markSvg = svg(m.w, m.h, rects(m), { title: "Conform" });
await writeFile(path.resolve(OUT, "../favicon.svg"), markSvg);
const inline = markSvg.replace(/ width="\d+" height="\d+"/, ' height="44" aria-hidden="true" focusable="false"').replace(/ role="img" aria-label="Conform"/, "").replace(/<title>Conform<\/title>\n/, "");
await writeFile(path.resolve(OUT, "../../src/logo.ts"), `// Generated by scripts/make-logo.mjs: the Conform keystone mark. Do not edit by hand.\nexport const LOGO_SVG = ${JSON.stringify(inline.trim())};\n`);
console.log(`mark ${m.w}×${m.h} px, lockup ${LW + 8}×${LH + 8} px → ${OUT}`);
