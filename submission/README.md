# Submission materials

Material for the Open Agentic Web Challenge video and Devpost page.

| File | What |
| --- | --- |
| `intro.mp4` | 8 s opening, 1920×1080, 30 fps, with sound |
| `outro.mp4` | 8 s closing, 1920×1080, 30 fps, with sound |
| `stills/` | Key frames (thumbnails, Devpost screenshots) |
| `video/` | The Remotion project that renders both clips |

## The two clips

Both continue the logo's idea, "The Keystone" (`docs/brand/LOGO.md`).

- **Intro.** A rush through pixel space. Twenty-six voxels fly in from the depth and assemble a 3×3×3
  cube, the shared specification, while the camera circles it. The keystone descends on a dotted line of
  light into its slot and locks: impact, flash, shockwave, and the drone resolves from E minor to E major.
  The camera slides aside for the wordmark and the line "Does your agentic site speak the spec?"
- **Closing.** The nine voxels of the top face light up one by one, C1 to C9, climbing the E major
  scale, mirrored by the checker's nine-cell bar. The keystone nods and locks again, still the brightest
  piece. "Check before you trust." and the lockup close the video.

## Sound and the rules

The rules forbid third-party music and brands. Every sound here is synthesized by
`video/scripts/make-audio.mjs` (oscillators, filtered noise, a delay and a small reverb), timed from the same
`video/src/timeline.ts` as the picture. No samples, loops or music from anyone else, and no third-party
names or logos appear on screen.

The narration must be your own voice. Keep the full video under 2 minutes: the two clips take 16 s, leaving
about 100 s for the demo.

## Render

From `submission/video` (Node 24, pnpm; the first render downloads Remotion's headless browser):

```shell
pnpm render                 # writes ../intro.mp4 and ../outro.mp4
pnpm studio                 # live preview and timeline scrubbing in the browser
```

Once the site is live, put its address under the closing lockup:

```shell
CONFORM_URL=conform.your-domain.tld pnpm render:outro:url
```

Remotion is free for individuals and companies of up to three people; see remotion.dev/license.
