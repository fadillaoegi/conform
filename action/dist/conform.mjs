#!/usr/bin/env node
import {
  run
} from "./chunk-JUC4T7C6.mjs";

// src/bin.ts
var code = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(`${text}
`),
  stderr: (text) => process.stderr.write(`${text}
`),
  isTty: Boolean(process.stdout.isTTY),
  env: process.env
});
process.exitCode = code;
