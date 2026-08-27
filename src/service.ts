import type { Server } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import * as z from "zod/v4";

import { loadSkill, PUBLIC_SKILLS } from "./skills.js";

export interface RunningService {
  close(): Promise<void>;
  url: URL;
}

export interface ServiceOptions {
  port?: number;
}

/** Creates one stateless MCP server with the stable two-tool interface. */
function createServer(): McpServer {
  const server = new McpServer({
    name: "chatgpt-chat-skills-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "load_skill",
    {
      description: "Load one skill by its exact canonical name.",
      inputSchema: { name: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ name }) => ({
      content: [{ type: "text", text: await loadSkill(name) }],
    }),
  );

  server.registerTool(
    "list_skills",
    {
      description: "List public skills available for explicit invocation.",
      inputSchema: {},
      outputSchema: {
        skills: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify({ skills: PUBLIC_SKILLS }) }],
      structuredContent: { skills: [...PUBLIC_SKILLS] },
    }),
  );

  return server;
}

/** Handles one stateless MCP request and closes its per-request resources. */
async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport();

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  } finally {
    await transport.close();
    await server.close();
  }
}

/** Returns an MCP-compatible method-not-allowed response. */
function rejectUnsupportedMethod(_req: Request, res: Response): void {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
}

/** Closes the underlying HTTP listener after active connections complete. */
async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/** Starts the MCP HTTP service on the loopback interface. */
export async function startService(
  options: ServiceOptions = {},
): Promise<RunningService> {
  const app = createMcpExpressApp({ host: "127.0.0.1" });
  app.post("/mcp", handleMcpRequest);
  app.get("/mcp", rejectUnsupportedMethod);
  app.delete("/mcp", rejectUnsupportedMethod);

  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(options.port ?? 2092, "127.0.0.1", () => {
      resolve(listener);
    });
    listener.once("error", reject);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await closeServer(server);
    throw new Error("HTTP service did not expose a TCP address");
  }

  return {
    url: new URL(`http://127.0.0.1:${address.port}`),
    close: async () => closeServer(server),
  };
}
