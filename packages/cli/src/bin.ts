#!/usr/bin/env node
// Entry point for the `conform` binary.
import { run } from "./run.ts";

const code = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
  isTty: Boolean(process.stdout.isTTY),
  env: process.env,
});
process.exitCode = code;
