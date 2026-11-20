# Video script (under 2 minutes)

Rules to keep: your own voice (no AI voice), no music or third-party brands, under 2:00, public on YouTube,
shown running in a browser. `intro.mp4` and `outro.mp4` are 8 s each and contain only synthesized sound.

Target: 1:52. Narration is about 230 words; read it at a calm pace. Lines in *italics* are what to show.

| Time | Picture | Narration |
| --- | --- | --- |
| 0:00–0:08 | `intro.mp4` | (none, or one breath before the next line) |
| 0:08–0:20 | *Waypoint Desk home page, then the partner card with its agent URL.* | "Agentic websites now call each other's agents. Your visitor's browser downloads another site's agent network and runs it. So before you trust a site's agent, how do you know it follows the spec?" |
| 0:20–0:45 | *Conform. Paste `http://localhost:8091/tidewhistle_guesthouse`, press Run check. The nine cells fill green; open C7 and C9.* | "This is Conform. I paste a site's agent URL, and Conform reads its public files the way a caller's browser would. It runs nine checks from the spec. Can another site read the files? Does a wrong network name fail closed? Do cycles and budgets stop? And in a real runtime, does the visitor's key stay with their own provider, and is consent asked before any contact? Every finding links to the spec, with a fix." |
| 0:45–0:58 | *Check the pizza example: WARN on C1.7, with its fix.* | "It already found a real gap in one of the official examples: a missing action bridge, so other sites could never run its agent." |
| 0:58–1:12 | *Get a signed badge, then Verify this badge: seven green steps.* | "A site that passes gets a signed badge. Anyone can verify it in the browser, and the badge turns stale as soon as the site's files change." |
| 1:12–1:38 | *Waypoint Desk chat: "Is Tidewhistle Guesthouse safe to call? Check it first, then ask what rooms it offers." Card 1 names Conform; Allow. Conform's answer: PASS. Card 2 names the guesthouse; Allow. The answer.* | "And Conform is itself an agentic website. Here, a travel site asks Conform before it calls a partner. First card: may we ask Conform? Conform checks the guesthouse: pass. Only then, second card: may we ask the guesthouse? Check before you trust, across sites, in the visitor's own browser." |
| 1:38–1:44 | *Terminal: `npx agentic-web-conformance check …`; a GitHub job summary.* | "The same checks run from the command line, as an npm package, and as a GitHub Action." |
| 1:44–1:52 | `outro.mp4` | (none) |

## Before you record

- Start the three local sites (see `apps/demo-caller/README.md`), or use the deployed URLs once live.
- Open each tab once beforehand so nothing loads on camera. Zoom the browser to about 125%.
- Enter your key in AI model settings **off camera**; never show the key or the provider dashboard
  (it is a third-party brand).
- Issue the badge once before recording, so the Verify view is ready; keep a second run for the take.
- The assistant uses a real model, so answers vary: record two or three takes of the Waypoint Desk scene
  and keep the clearest.

## Recording and editing

- Screen: QuickTime (File → New Screen Recording) or OBS, 1920×1080, 30 fps.
- Voice: record the narration separately in a quiet room with any headset microphone, then place it
  over the screen recording. Speak in your own voice; English or Indonesian with English subtitles both
  work.
- Join `intro.mp4`, the demo and `outro.mp4` in any editor (iMovie, DaVinci Resolve, CapCut desktop).
  Do not add music. Export 1080p, H.264.
- Upload to YouTube as Public, title for example "Conform: conformance checker for the open agentic web".

## Optional scene

The organizers' own listed site currently serves its agent files without CORS, so other sites' browsers
cannot load it (checked on 18 November). That is a strong "real web" moment, but consider telling the
organizers first, for example through a friendly GitHub issue, before showing it in the video.
