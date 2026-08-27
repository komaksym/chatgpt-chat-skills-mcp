import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { startService, type RunningService } from "../src/service.js";

describe("skills MCP service", () => {
  let service: RunningService | undefined;
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
    await service?.close();
  });

  it("lists and loads handoff through the real loopback transport", async () => {
    service = await startService({ port: 0 });
    client = new Client({ name: "black-box-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL("/mcp", service.url),
    );

    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map(({ name }) => name)).toEqual([
      "load_skill",
      "list_skills",
    ]);

    const loadTool = tools.tools.find(({ name }) => name === "load_skill");
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
          name: "handoff",
          description:
            "Create a compact continuation brief for another conversation.",
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
  });
});
