# agentic-web-conformance

Check an agentic website against the [Worldwide Agentic Web MVP specification](https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md)
(MVP Profile 0.2): public agent files, CORS, the data-only network definition, exact-name resolution,
fail-closed limits, origin policy, key and private-context isolation, and consent before contact. Each
finding carries evidence, a suggested fix and the spec section. No AI model is called.

```shell
npx agentic-web-conformance check https://your-site.example/agents/assistant
npx agentic-web-conformance check https://your-site.example/ --json --out report.json
npx agentic-web-conformance check https://your-site.example/agents/assistant --fail-on warn --summary summary.md
```

Exit codes: `0` no failing finding, `1` a finding at or above `--fail-on`, `2` bad usage or a crash.
Run `conform --help` for every option. Requires Node.js 24 or newer.

```js
import { checkNetwork, formatMarkdown } from "agentic-web-conformance";

const report = await checkNetwork("https://your-site.example/agents/assistant");
console.log(report.summary.worst, formatMarkdown(report));
```

Checks C1–C9 are automated; C10–C14 are planned. The checks C4–C9 load the site's real files into a pinned
copy of the reference browser runtime (nsdeploy `53a787c`, Apache-2.0) and drive it with a scripted
stand-in router. Bound to spec commit `fd872b9`.

License: Apache-2.0.
