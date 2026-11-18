// Presenter: the badge image, a pixel-style two-part label. Only fixed words go into the SVG, never site text.

import type { BadgeState } from "../../domain/badge.ts";

const SHIELD = [
  "..XXXXXX..", ".XOOOOOOX.", "XOOOOOOGOX", "XOOOOOGGOX", "XOGOOGGOOX", "XOGGGGOOOX", ".XOGGOOOX.", "..XOOOOX..", "...XOOX...", "....XX....",
];

const COLORS: Record<string, { bg: string; fg: string }> = {
  "pass": { bg: "#38b764", fg: "#1a1c2c" },
  "warn": { bg: "#ffcd75", fg: "#1a1c2c" },
  "stale": { bg: "#566c86", fg: "#f4f4f4" },
  "expired": { bg: "#566c86", fg: "#f4f4f4" },
  "unreachable": { bg: "#566c86", fg: "#f4f4f4" },
  "unknown": { bg: "#b13e53", fg: "#f4f4f4" },
};

export function badgeLabel(result: "pass" | "warn" | null, state: BadgeState | "unknown"): { text: string; color: keyof typeof COLORS } {
  if (state === "unknown" || result === null) return { text: "UNKNOWN", color: "unknown" };
  if (state === "stale") return { text: "STALE", color: "stale" };
  if (state === "expired") return { text: "EXPIRED", color: "expired" };
  if (state === "unreachable") return { text: `${result.toUpperCase()}?`, color: "unreachable" };
  return { text: result === "pass" ? "MVP 0.2 PASS" : "MVP 0.2 WARN", color: result };
}

export function badgeSvg(result: "pass" | "warn" | null, state: BadgeState | "unknown"): string {
  const { text, color } = badgeLabel(result, state);
  const palette = COLORS[color] as { bg: string; fg: string };
  const charW = 7;
  const left = 22 + "CONFORM".length * charW + 10;
  const right = text.length * charW + 16;
  const width = left + right;
  let pixels = "";
  SHIELD.forEach((row, y) => [...row].forEach((c, x) => {
    const fill = c === "X" ? "#f4f4f4" : c === "O" ? "#29366f" : c === "G" ? "#a7f070" : null;
    if (fill) pixels += `<rect x="${6 + x}" y="${5 + y}" width="1" height="1" fill="${fill}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20" role="img" aria-label="Conform: ${text}" shape-rendering="crispEdges">
<title>Conform: ${text}</title>
<rect width="${width}" height="20" fill="#0d0e16"/>
<rect x="1" y="1" width="${left - 1}" height="18" fill="#1a1c2c"/>
<rect x="${left}" y="1" width="${right - 1}" height="18" fill="${palette.bg}"/>
<rect x="${left}" y="16" width="${right - 1}" height="3" fill="#000" fill-opacity="0.2"/>
${pixels}
<g font-family="'Press Start 2P','DejaVu Sans Mono',Menlo,Consolas,monospace" font-size="10" font-weight="700">
<text x="22" y="14" fill="#f4f4f4">CONFORM</text>
<text x="${left + 8}" y="14" fill="${palette.fg}">${text}</text>
</g>
</svg>
`;
}
