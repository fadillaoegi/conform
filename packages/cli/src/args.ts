// Command-line parsing for `conform`. No dependencies; every option is documented in USAGE.

export type FailOn = "fail" | "warn";

export interface CheckArgs {
  command: "check";
  url: string;
  json: boolean;
  out: string | null;
  staticOnly: boolean;
  origin: string | null;
  timeoutMs: number | null;
  failOn: FailOn;
  evidence: boolean;
  problemsOnly: boolean;
  color: boolean | null;
}

export type Args = CheckArgs | { command: "help" } | { command: "version" };

export const USAGE = `Usage: conform check <url> [options]

Check an Open Agentic Web site against the Worldwide Agentic Web MVP specification.

<url> is a network URL (the folder that holds agent-manifest.json, then the network
name, such as https://site.example/agents/transit), a site base ending in "/", or the
manifest URL itself.

Options:
  --json               Print the full JSON report instead of text.
  --out <file>         Also write the JSON report to <file>.
  --static-only        Run only the static checks (C1-C3); skip the runtime harness.
  --origin <origin>    The caller origin to evaluate CORS against (default https://conform.example).
  --timeout <ms>       Timeout per artifact request (default 15000).
  --fail-on <level>    Exit 1 on "fail" (default) or on "warn" and worse.
  --evidence           Show each finding's evidence in text output.
  --problems           Show only fail, warn and untestable findings in text output.
  --color / --no-color Force or disable colors (default: on for a terminal, off with NO_COLOR).
  -h, --help           Show this help.
  -v, --version        Show the version and the spec commit it checks against.

Exit codes: 0 no failing finding, 1 a finding at or above --fail-on, 2 bad usage or crash.`;

export class UsageError extends Error {}

const VALUE_OPTIONS = new Set(["--out", "--origin", "--timeout", "--fail-on"]);

export function parseArgs(argv: string[]): Args {
  if (argv.length === 0) throw new UsageError("Missing command.");
  if (argv.includes("-h") || argv.includes("--help") || argv[0] === "help") return { command: "help" };
  if (argv.includes("-v") || argv.includes("--version") || argv[0] === "version") return { command: "version" };
  const [command, ...rest] = argv;
  if (command !== "check") throw new UsageError(`Unknown command "${command}". Use "conform check <url>".`);
  const args: CheckArgs = {
    command: "check",
    url: "",
    json: false,
    out: null,
    staticOnly: false,
    origin: null,
    timeoutMs: null,
    failOn: "fail",
    evidence: false,
    problemsOnly: false,
    color: null,
  };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i] as string;
    if (VALUE_OPTIONS.has(arg)) {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith("--")) throw new UsageError(`${arg} needs a value.`);
      i += 1;
      if (arg === "--out") args.out = value;
      else if (arg === "--origin") {
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          throw new UsageError(`--origin needs an origin such as https://my-site.example, not "${value}".`);
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new UsageError("--origin must be http or https.");
        args.origin = url.origin;
      } else if (arg === "--timeout") {
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) throw new UsageError("--timeout needs a positive number of milliseconds.");
        args.timeoutMs = n;
      } else {
        if (value !== "fail" && value !== "warn") throw new UsageError('--fail-on must be "fail" or "warn".');
        args.failOn = value;
      }
    } else if (arg === "--json") args.json = true;
    else if (arg === "--static-only") args.staticOnly = true;
    else if (arg === "--evidence") args.evidence = true;
    else if (arg === "--problems") args.problemsOnly = true;
    else if (arg === "--color") args.color = true;
    else if (arg === "--no-color") args.color = false;
    else if (arg.startsWith("-")) throw new UsageError(`Unknown option ${arg}.`);
    else if (args.url === "") args.url = arg;
    else throw new UsageError(`Unexpected argument "${arg}". Check one URL per run.`);
  }
  if (args.url === "") throw new UsageError("Give the URL to check.");
  return args;
}
