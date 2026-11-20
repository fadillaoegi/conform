# Conform GitHub Action

Checks an agentic website against the Worldwide Agentic Web MVP spec on every push or pull request, and
writes the report to the job summary. It runs Conform's bundled CLI (`dist/`, no dependencies) on Node 24.

```yaml
name: Agentic web conformance
on: [push, pull_request]
jobs:
  conform:
    runs-on: ubuntu-latest
    steps:
      - uses: <owner>/<repo>/action@main   # the repository that holds this folder
        with:
          url: https://your-site.example/agents/assistant
          fail-on: fail        # or "warn"
```

| Input | Default | Meaning |
| --- | --- | --- |
| `url` | required | Network URL (folder that holds `agent-manifest.json`, then the network name), or a site folder ending in `/`. |
| `fail-on` | `fail` | Fail the step on `fail`, or on `warn` and worse. |
| `static-only` | `false` | Run only the static checks C1–C3. |
| `origin` | `https://conform.example` | Caller origin used to evaluate CORS. |
| `node-version` | `24` | Node.js version to set up. |

Outputs: `result` (`pass`, `warn` or `fail`), `fail`, `warn`, and `report` (path of the JSON report).

To check a site you deploy in the same workflow, run this step after the deploy step. The checks contact only
the site's public agent files, once per run.

Rebuild `dist/` after changing the checker: `pnpm --filter agentic-web-conformance bundle`.
