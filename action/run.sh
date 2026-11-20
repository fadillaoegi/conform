#!/usr/bin/env bash
# Runs the bundled Conform CLI for the GitHub Action (inputs arrive as environment variables).
set -uo pipefail
here="${GITHUB_ACTION_PATH:-$(cd "$(dirname "$0")" && pwd)}"
report="${RUNNER_TEMP:-/tmp}/conform-report.json"
args=(check "$CONFORM_URL" --out "$report" --fail-on "${CONFORM_FAIL_ON:-fail}" --no-color)
[ "${CONFORM_STATIC_ONLY:-false}" = "true" ] && args+=(--static-only)
[ -n "${CONFORM_ORIGIN:-}" ] && args+=(--origin "$CONFORM_ORIGIN")
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && args+=(--summary "$GITHUB_STEP_SUMMARY")
node "$here/dist/conform.mjs" "${args[@]}"
code=$?
if [ -f "$report" ] && [ -n "${GITHUB_OUTPUT:-}" ]; then
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const lines = [`result=${r.summary.worst}`, `fail=${r.summary.fail}`, `warn=${r.summary.warn}`, `report=${process.argv[1]}`];
    require("fs").appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  ' "$report"
fi
exit $code
