// The `conform` command, as a function that tests can call without a child process.

import { appendFile, writeFile } from "node:fs/promises";
import { checkNetwork, CONFORM_VERSION, SPEC, type CheckOptions, type Report } from "@conform/core";
import { parseArgs, USAGE, UsageError, type CheckArgs } from "./args.ts";
import { formatReport } from "./format.ts";
import { formatMarkdown } from "./markdown.ts";

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  isTty: boolean;
  env: Record<string, string | undefined>;
  fetch?: typeof fetch;
}

export function exitCodeFor(report: Report, failOn: CheckArgs["failOn"]): number {
  if (report.summary.fail > 0) return 1;
  if (failOn === "warn" && report.summary.warn > 0) return 1;
  return 0;
}

function useColor(args: CheckArgs, io: Io): boolean {
  if (args.color !== null) return args.color;
  if (args.json) return false;
  if (io.env["NO_COLOR"] !== undefined && io.env["NO_COLOR"] !== "") return false;
  if (io.env["FORCE_COLOR"] && io.env["FORCE_COLOR"] !== "0") return true;
  return io.isTty;
}

export async function run(argv: string[], io: Io): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`conform: ${error.message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
  if (parsed.command === "help") {
    io.stdout(USAGE);
    return 0;
  }
  if (parsed.command === "version") {
    io.stdout(`conform ${CONFORM_VERSION} (spec ${SPEC.specCommit}, ${SPEC.profile})`);
    return 0;
  }
  const args = parsed;
  const options: CheckOptions = { staticOnly: args.staticOnly };
  if (args.origin) options.callerOrigin = args.origin;
  if (args.timeoutMs !== null) options.timeoutMs = args.timeoutMs;
  if (io.fetch) options.fetch = io.fetch;
  let report: Report;
  try {
    report = await checkNetwork(args.url, options);
  } catch (error) {
    io.stderr(`conform: the check stopped on an unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  const json = JSON.stringify(report, null, 2);
  if (args.out) {
    try {
      await writeFile(args.out, `${json}\n`, "utf8");
    } catch (error) {
      io.stderr(`conform: cannot write ${args.out}: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
  }
  if (args.summary) {
    try {
      await appendFile(args.summary, formatMarkdown(report), "utf8");
    } catch (error) {
      io.stderr(`conform: cannot write ${args.summary}: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
  }
  io.stdout(args.json ? json : formatReport(report, { color: useColor(args, io), evidence: args.evidence, problemsOnly: args.problemsOnly }));
  if (args.out && !args.json) io.stderr(`conform: JSON report written to ${args.out}`);
  return exitCodeFor(report, args.failOn);
}

export { parseArgs, USAGE } from "./args.ts";
export { formatReport } from "./format.ts";
export { formatMarkdown } from "./markdown.ts";
