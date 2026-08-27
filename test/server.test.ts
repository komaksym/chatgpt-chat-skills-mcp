import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { startService, type RunningService } from "../src/service.js";

/** Returns a tool's canonical protocol name. */
function readToolName(tool: { name: string }): string {
  return tool.name;
}

/** Identifies the load tool in a discovered tool list. */
function isLoadTool(tool: { name: string }): boolean {
  return tool.name === "load_skill";
}

/** Defines the black-box service behavior suite. */
function defineServiceSuite(): void {
  let service: RunningService | undefined;
  let client: Client | undefined;

  /** Releases protocol and network resources after each test. */
  async function cleanup(): Promise<void> {
    await client?.close();
    await service?.close();
  }

  afterEach(cleanup);

  /** Proves discovery and loading through the production HTTP boundary. */
  async function listsAndLoadsHandoff(): Promise<void> {
    service = await startService({ port: 0 });
    client = new Client({ name: "black-box-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL("/mcp", service.url),
    );

    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map(readToolName)).toEqual([
      "load_skill",
      "list_skills",
    ]);

    const loadTool = tools.tools.find(isLoadTool);
    expect(loadTool?.inputSchema).toMatchObject({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    });
    expect(JSON.stringify(loadTool?.inputSchema)).not.toContain("enum");
    expect(JSON.stringify(loadTool?.inputSchema)).not.toContain("handoff");

    const listing = await client.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toEqual({
      skills: [
        {
          name: "code-review",
          description:
            "Review a committed GitHub diff on separate Standards and Spec axes with strict child-chat isolation.",
        },
        {
          name: "grill-with-docs",
          description:
            "Stress-test a plan through evidence-led decisions and durable domain language.",
        },
        {
          name: "handoff",
          description:
            "Create a compact continuation brief for another conversation.",
        },
        {
          name: "implement",
          description:
            "Implement one settled GitHub ticket through TDD, observed verification, committed review, and a pull request.",
        },
        {
          name: "setup-matt-pocock-skills",
          description:
            "Establish minimal GitHub-first domain documentation from repository evidence.",
        },
      ],
    });

    const loaded = CallToolResultSchema.parse(
      await client.callTool({
        name: "load_skill",
        arguments: { name: "handoff" },
      }),
    );
    const text = loaded.content[0];
    expect(text).toMatchObject({ type: "text" });
    if (!text || text.type !== "text") {
      throw new Error("Expected text content");
    }
    expect(text.text).toContain("Remote execution contract");
    expect(text.text).toContain("# handoff");
    expect(text.text).toContain("suggested skills");
    expect(text.text).not.toContain("6654f6b60cd9d5be8b54c6fafe44346dabeb3b76");
    expect(text.text).not.toContain("Copyright (c) 2026 Matt Pocock");
  }

  it("lists and loads handoff through the real loopback transport", listsAndLoadsHandoff);
}

describe("skills MCP service", defineServiceSuite);
