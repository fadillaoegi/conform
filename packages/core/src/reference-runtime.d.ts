// Minimal typings for the pinned reference runtime modules Conform imports.
// The runtime is plain JavaScript; only the surface used here is declared.

declare module "@conform/reference-runtime/runtime/hocon.js" {
  export function parseHocon(text: string): Record<string, unknown>;
  export function isPlainObject(value: unknown): value is Record<string, unknown>;
}

declare module "@conform/reference-runtime/runtime/kernel.js" {
  export class AgentNetwork {
    constructor(config: Record<string, unknown>, name: string);
    config: Record<string, unknown>;
    name: string;
    linkSlots: Set<string>;
    findFrontMan(): string | null;
    getAgentSpec(name: string): Record<string, unknown> | null;
    classifyTool(ref: unknown): { kind: string; ref: unknown; spec: Record<string, unknown> | undefined };
  }
  export function validateNetwork(network: AgentNetwork): {
    errors: string[];
    warnings: string[];
    externals: string[];
    mcps: string[];
  };
  export function parseExternalAgent(ref: string, baseOrigin: string): { origin: string; agentName: string; url: string };
}

declare module "@conform/reference-runtime/runtime/generated/graph.gen.mjs" {
  export function find_front_man(config: Record<string, unknown>): string | null;
  export function classify_tool(config: Record<string, unknown>, ref: unknown): string;
  export function agent_names(config: Record<string, unknown>): string[];
}

declare module "@conform/reference-runtime/runtime/remote.js" {
  export function resolveUrl(base: string, path: string): string;
  export class RemoteRegistry {
    constructor(options?: { maxDepth?: number; trace?: unknown });
    maxDepth: number;
    checkCycle(chain: string[], origin: string, agentName: string): void;
  }
}

declare module "@conform/reference-runtime/runtime/runner.js" {
  export interface Composition {
    remoteCalls: number;
    peerCalls: Map<string, number>;
    maxRemoteCalls: number;
    maxCallsPerPeer: number;
    agentCalls: number;
    maxAgentCalls: number;
    deadline: number;
  }
  export function consumeRemoteBudget(composition: Composition, targetKey: string, now?: number): string | null;
  export function consumeAgentBudget(composition: Composition, now?: number): string | null;
  export function requiresThirdPartyApproval(ref: unknown, baseOrigin: string): boolean;
  export function safeName(value: string): string;
}

declare module "@conform/reference-runtime/runtime/engine.js" {
  export class Engine {
    constructor(options?: { originUrl?: string; byokKey?: string; routerOverride?: string; modelOverride?: string });
    top: { manifest: Record<string, unknown>; base: string; network: { name: string; findFrontMan(): string | null } } | null;
    registry: { maxDepth: number; checkCycle(chain: string[], origin: string, agentName: string): void };
    runtimeAllowedPeers: Set<string>;
    onConsent: ((info: Record<string, unknown>) => Promise<string>) | null;
    trace: { events: Array<Record<string, unknown>> };
    loadTop(): Promise<{ network: { name: string }; manifest: Record<string, unknown>; validation: { errors: string[] } }>;
    resolveRemote(
      ref: string,
      chain: string[],
      parentSpan: string | null,
      sourceManifest?: Record<string, unknown>,
    ): Promise<{ network: { name: string; findFrontMan(): string | null }; base: string; manifest: Record<string, unknown> }>;
  }
  export function manifestAllowsPeer(target: string, manifest: Record<string, unknown>, runtimeAllowedPeers?: Set<string>): boolean;
}

declare module "@conform/reference-runtime/runtime/mcp.js" {
  export class McpClient {
    constructor(options: { url: string; trace?: unknown; headers?: Record<string, string> });
    listTools(parentSpan?: unknown): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>>;
    callTool(name: string, args: Record<string, unknown>, parentSpan?: unknown): Promise<string>;
  }
}
