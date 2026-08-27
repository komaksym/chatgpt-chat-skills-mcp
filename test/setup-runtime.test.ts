import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { startService, type RunningService } from "../src/service.js";

const SETUP_ROOT = new URL("../skills/setup-matt-pocock-skills/", import.meta.url);

interface BehaviorFixture {
  expected: string[];
  forbidden: string[];
  given: string[];
  id: string;
}

/** Defines the remote-first setup runtime contract tests. */
function defineSetupRuntimeSuite(): void {
  let service: RunningService | undefined;
  let client: Client | undefined;

  /** Releases protocol and network resources after each test. */
  async function cleanup(): Promise<void> {
    await client?.close();
    await service?.close();
  }

  afterEach(cleanup);

  /** Loads the setup workflow through the production MCP boundary. */
  async function loadsRemoteFirstSetup(): Promise<void> {
    service = await startService({ port: 0 });
    client = new Client({ name: "setup-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );

    const listing = await client.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toEqual({
      skills: [
        {
          name: "handoff",
          description:
            "Create a compact continuation brief for another conversation.",
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
        arguments: { name: "setup-matt-pocock-skills" },
      }),
    );
    const block = loaded.content[0];
    if (!block || block.type !== "text") {
      throw new Error("Expected setup runtime text");
    }
    expect(block.text).toContain("connected GitHub capabilities");
    expect(block.text).toMatch(/Verify read\s+access/);
    expect(block.text).toMatch(/Verify write\s+access/);
    expect(block.text).toContain("single-context");
    expect(block.text).toContain("repository structure and domain language");
    expect(block.text).toContain("not persisted");
    expect(block.text).toContain("Do not create empty");
    expect(block.text).not.toMatch(/AGENTS\.md|CLAUDE\.md|GitLab|Jira|\.scratch|`gh`/);
  }

  /** Proves the vendored source is the exact pinned upstream skill text. */
  async function preservesPinnedUpstreamSource(): Promise<void> {
    const source = await readFile(new URL("upstream.md", SETUP_ROOT), "utf8");
    const digest = createHash("sha256").update(source).digest("hex");
    expect(digest).toBe(
      "2bcd89e97777cdb705914424e39c97d5db524c8eb4eafac8120778a07774f0ec",
    );
  }

  /** Proves all four required setup outcomes have durable behavior fixtures. */
  async function coversRequiredSetupOutcomes(): Promise<void> {
    const source = await readFile(
      new URL("behavior-fixtures.json", SETUP_ROOT),
      "utf8",
    );
    const fixtures = JSON.parse(source) as BehaviorFixture[];
    expect(fixtures.map(readFixtureId)).toEqual([
      "writable-single-context",
      "read-only",
      "single-context-default",
      "evidence-backed-multi-context",
    ]);
    const [writable, readOnly, single, multi] = fixtures;
    if (!writable || !readOnly || !single || !multi) {
      throw new Error("Expected four setup behavior fixtures");
    }
    expect(writable.expected).toContain(
      "Persist only populated, evidence-backed domain documentation.",
    );
    expect(readOnly.expected).toContain(
      "State that the proposal was not persisted.",
    );
    expect(single.forbidden).toContain(
      "Create a context map merely because the repository is a monorepo.",
    );
    expect(multi.expected).toContain(
      "Wait for confirmation before persisting the multi-context layout.",
    );
  }

  /** Returns a behavior fixture's stable identifier. */
  function readFixtureId(fixture: { id: string }): string {
    return fixture.id;
  }

  it("loads the remote-first setup workflow", loadsRemoteFirstSetup);
  it("preserves the pinned upstream source", preservesPinnedUpstreamSource);
  it("covers required setup outcomes", coversRequiredSetupOutcomes);
}

describe("setup-matt-pocock-skills runtime", defineSetupRuntimeSuite);
