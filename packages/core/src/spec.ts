// The specification and reference runtime this version of Conform is bound to.
// A report always carries these so a reader knows which spec text was checked.

export const CONFORM_VERSION = "0.1.0";

export const SPEC = {
  repo: "https://github.com/cognizant-ai-labs/agentic-web",
  repoCommit: "63a956cf4653f610b1c238c70946f4d7647d17a8",
  repoCommitDate: "2026-11-13",
  path: "docs/worldwide_agentic_web_mvp_spec.md",
  specCommit: "fd872b9221aeb8ff762b75a5badbf84b23c133cc",
  specCommitDate: "2026-11-10",
  profile: "MVP Profile 0.2 (6 November 2026)",
} as const;

export const RUNTIME = {
  name: "agentify-website skill runtime (nsdeploy browser runtime + skill edits)",
  upstreamPath: "skills/agentify-website/runtime",
  repoCommit: SPEC.repoCommit,
  nsdeployCommit: "53a787c",
  nsdeployCommitDate: "2026-11-11",
  // Limits the pinned runtime enforces per visitor message (runtime/engine.js, runTurn).
  limits: {
    maxRemoteCalls: 4,
    maxCallsPerPeer: 1,
    maxAgentCalls: 24,
    deadlineMs: 90_000,
    maxCompositionDepth: 5,
    defaultMaxSteps: 12,
  },
} as const;

export type SpecRef = typeof SPEC;
export type RuntimeRef = typeof RUNTIME;
