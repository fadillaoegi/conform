// Self-hosted pixel fonts (Fontsource). Rendering waits until they are loaded, so no frame shows a fallback.
import "@fontsource/press-start-2p/400.css";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import { continueRender, delayRender } from "remotion";

let started = false;

export function loadFonts(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading pixel fonts");
  Promise.all([
    document.fonts.load("40px 'Press Start 2P'"),
    document.fonts.load("40px 'Pixelify Sans'"),
    document.fonts.load("600 40px 'Pixelify Sans'"),
  ]).then(() => continueRender(handle), () => continueRender(handle));
}
