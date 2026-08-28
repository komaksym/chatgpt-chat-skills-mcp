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
    expect(listing.structuredContent).toMatchObject({
      skills: expect.arrayContaining([
        {
          name: "setup-matt-pocock-skills",
          description:
            "Establish minimal GitHub-first domain documentation from repository evidence.",
        },
      ]),
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
    expect(block.text).toContain("more than one plausible repository");
    expect(block.text).toContain("single-context");
    expect(block.text).toContain("domain glossary");
    expect(block.text).toContain("_Avoid_");
    expect(block.text).toContain("implementation identifiers");
    expect(block.text).toContain("complete proposed files and contents");
    expect(block.text).toContain("branch");
    expect(block.text).toContain("pull request");
    expect(block.text).toContain("direct-write approval");
    expect(block.text).toContain("partial");
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

  /** Proves setup's remote adaptation edge cases have durable behavior fixtures. */
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
      "ambiguous-repository",
      "ambiguous-domain-language",
      "existing-context-topology",
      "direct-write-fallback",
      "partial-write-failure",
    ]);

    const byId = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
    expect(byId.get("writable-single-context")?.expected).toContain(
      "Show the complete proposed files and contents and wait for user approval before the first mutation.",
    );
    expect(byId.get("read-only")?.expected).toContain(
      "State that the proposal was not persisted.",
    );
    expect(byId.get("single-context-default")?.forbidden).toContain(
      "Create a context map merely because the repository is a monorepo.",
    );
    expect(byId.get("evidence-backed-multi-context")?.expected).toContain(
      "Wait for confirmation before persisting the multi-context layout.",
    );
    expect(byId.get("ambiguous-repository")?.forbidden).toContain(
      "Guess the active repository from recency or search ranking.",
    );
    expect(byId.get("ambiguous-domain-language")?.forbidden).toContain(
      "Choose a canonical term merely from implementation identifiers or occurrence counts.",
    );
    expect(byId.get("existing-context-topology")?.expected).toContain(
      "Make reruns idempotent and avoid formatting churn or duplicate terms.",
    );
    expect(byId.get("direct-write-fallback")?.expected).toContain(
      "Disclose the exact target branch and ask for explicit direct-write approval before mutating it.",
    );
    expect(byId.get("partial-write-failure")?.expected).toContain(
      "Stop dependent writes, inspect the resulting repository state, and report exactly what persisted and what did not.",
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
