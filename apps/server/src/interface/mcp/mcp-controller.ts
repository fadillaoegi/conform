// Interface: a minimal MCP server (JSON-RPC 2.0 over HTTP, protocol 2025-06-18, plain JSON responses),
// the transport the reference runtime's MCP client speaks. It only calls use cases.

import { randomUUID } from "node:crypto";
import { compactText, CONFORM_VERSION } from "@conform/core";
import type { App } from "../app.ts";

const PROTOCOL = "2025-06-18";

export const TOOLS = [
  {
    name: "check_site",
    description: "Run Conform's automated conformance checks (C1 to C9 of the Worldwide Agentic Web MVP spec) against a public HTTPS agentic website and return the result with each failure or warning and its fix. Give a network URL: the site folder that holds agent-manifest.json, then the network name.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["url"],
      properties: { url: { type: "string", maxLength: 2048, description: "Network URL, such as https://site.example/agents/transit." } },
    },
  },
  {
    name: "badge_status",
    description: "Look up Conform's signed badge for a network URL: whether one was issued, its result, and whether it is still valid (not expired, and the site's files unchanged since).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["url"],
      properties: { url: { type: "string", maxLength: 2048, description: "Network URL." } },
    },
  },
  {
    name: "explain_check",
    description: "Explain one Conform check id (C1 to C14) or finding id (such as C2.4): what it proves and its spec sections.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "string", maxLength: 8, description: "Check or finding id." } },
    },
  },
] as const;

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface McpReply {
  status: number;
  body: unknown | null;
  sessionId?: string;
}

function result(text: string, structured?: unknown, isError = false): Record<string, unknown> {
  const out: Record<string, unknown> = { content: [{ type: "text", text }], isError };
  if (structured !== undefined) out["structuredContent"] = structured;
  return out;
}

async function callTool(app: App, name: unknown, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    if (name === "check_site") {
      const compact = await app.checkSite.compact(args["url"]);
      return result(compactText(compact), compact);
    }
    if (name === "badge_status") {
      const badge = await app.findBadge.execute(args["url"]);
      if (!badge) return result(`Conform has issued no badge for ${String(args["url"])}. Run check_site to see its current result.`, { badge: null });
      const summary = `Badge ${badge.id} for ${badge.payload.network}: ${badge.payload.result.toUpperCase()}, state ${badge.state} (issued ${badge.payload.issuedAt.slice(0, 10)}, expires ${badge.payload.expiresAt.slice(0, 10)}). Verify: ${badge.links.json}`;
      return result(summary, { id: badge.id, state: badge.state, result: badge.payload.result, network: badge.payload.network, issuedAt: badge.payload.issuedAt, expiresAt: badge.payload.expiresAt, links: badge.links });
    }
    if (name === "explain_check") {
      const info = app.explainCheck.execute(args["id"]);
      if (!info) return result(`"${String(args["id"])}" is not a Conform check id. Use C1 to C14, or a finding id such as C2.4.`, undefined, true);
      return result(`${info.id} ${info.name} (${info.automated ? "automated" : "planned"}; spec ${info.spec.join(", ")}): ${info.proves}`, info);
    }
    return result(`Unknown tool ${String(name)}.`, undefined, true);
  } catch (error) {
    return result(error instanceof Error ? error.message : String(error), undefined, true);
  }
}

export async function handleMcp(app: App, raw: string): Promise<McpReply> {
  let request: RpcRequest;
  try {
    request = JSON.parse(raw) as RpcRequest;
  } catch {
    return { status: 400, body: { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } } };
  }
  if (Array.isArray(request)) return { status: 400, body: { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Batches are not supported" } } };
  if (request.id === undefined) return { status: 202, body: null };
  const id = request.id ?? null;
  const reply = (value: unknown): McpReply => ({ status: 200, body: { jsonrpc: "2.0", id, result: value } });
  switch (request.method) {
    case "initialize": {
      const requested = typeof request.params?.["protocolVersion"] === "string" ? (request.params["protocolVersion"] as string) : PROTOCOL;
      return {
        ...reply({
          protocolVersion: requested,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "conform", title: "Conform conformance checker", version: CONFORM_VERSION },
          instructions: "Conform checks agentic websites against the Worldwide Agentic Web MVP spec. Use check_site for a live result, badge_status for a signed badge, explain_check for what a check means.",
        }),
        sessionId: randomUUID(),
      };
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const params = request.params ?? {};
      const args = (params["arguments"] && typeof params["arguments"] === "object" ? params["arguments"] : {}) as Record<string, unknown>;
      return reply(await callTool(app, params["name"], args));
    }
    default:
      return { status: 200, body: { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${String(request.method)}` } } };
  }
}
