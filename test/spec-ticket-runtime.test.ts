import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { startService, type RunningService } from "../src/service.js";

const SKILLS_ROOT = new URL("../skills/", import.meta.url);

interface BehaviorFixture {
  expected: string[];
  forbidden: string[];
  given: string;
  id: string;
}

/** Loads one skill and returns its protocol text block. */
async function loadText(client: Client, name: string): Promise<string> {
  const result = CallToolResultSchema.parse(
    await client.callTool({ name: "load_skill", arguments: { name } }),
  );
  const block = result.content[0];
  if (!block || block.type !== "text") {
    throw new Error(`Expected text for ${name}`);
  }
  return block.text;
}

/** Computes the SHA-256 digest of a vendored UTF-8 artifact. */
async function digest(path: URL): Promise<string> {
  const source = await readFile(path, "utf8");
  return createHash("sha256").update(source).digest("hex");
}

/** Returns a behavior fixture's stable identifier. */
function readFixtureId(fixture: { id: string }): string {
  return fixture.id;
}

/** Defines the GitHub specification and ticket workflow contract tests. */
function defineSpecTicketRuntimeSuite(): void {
  let service: RunningService | undefined;
  let client: Client | undefined;

  /** Releases protocol and network resources after each test. */
  async function cleanup(): Promise<void> {
    await client?.close();
    await service?.close();
  }

  /** Connects an official MCP client to the production service. */
  async function connect(): Promise<Client> {
    service = await startService({ port: 0 });
    client = new Client({ name: "spec-ticket-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    return client;
  }

  afterEach(cleanup);

  /** Proves both public workflows load through the production MCP seam. */
  async function listsAndLoadsWorkflows(): Promise<void> {
    const connected = await connect();
    const listing = await connected.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toMatchObject({
      skills: expect.arrayContaining([
        {
          name: "to-spec",
          description:
            "Synthesize settled work into a GitHub specification without restarting discovery.",
        },
        {
          name: "to-tickets",
          description:
            "Turn settled work into approved GitHub tracer-bullet tickets with explicit relationships.",
        },
      ]),
    });

    const spec = await loadText(connected, "to-spec");
    const tickets = await loadText(connected, "to-tickets");
    expect(spec).toContain("Do not restart grilling");
    expect(spec).toContain("highest existing behavioral test seam");
    expect(spec).toContain(
      "Not published: GitHub write access is unavailable or unverified.",
    );
    expect(spec).not.toMatch(/GitLab|Jira|\.scratch|ready-for-agent|`gh`/);
    expect(tickets).toContain("wait for explicit user approval");
    expect(tickets).toContain("tracer-bullet vertical slices");
    expect(tickets).toContain(
      "parent/sub-issue membership separately from execution blockers",
    );
    expect(tickets).toContain("native connected GitHub");
    expect(tickets).toContain("authenticated GitHub REST");
    expect(tickets).toContain("## Blocked by");
    expect(tickets).not.toMatch(/GitLab|Linear|Jira|\.scratch|ready-for-agent|`gh`/);
  }

  /** Proves relationship fallbacks are explicit and in strongest-first order. */
  async function preservesRelationshipFallbackOrder(): Promise<void> {
    const connected = await connect();
    const tickets = await loadText(connected, "to-tickets");
    const native = tickets.indexOf("native connected GitHub");
    const rest = tickets.indexOf("authenticated GitHub REST");
    const markdown = tickets.indexOf("issue body with `## Parent`");
    expect(native).toBeGreaterThan(-1);
    expect(rest).toBeGreaterThan(native);
    expect(markdown).toBeGreaterThan(rest);
    expect(tickets).toContain(
      "Never invent credentials and never silently\ndrop a relationship",
    );
  }

  /** Proves the vendored sources are exact copies from the pinned upstream commit. */
  async function preservesPinnedUpstreamSources(): Promise<void> {
    expect(await digest(new URL("to-spec/upstream.md", SKILLS_ROOT))).toBe(
      "43ad9cf318e5e7d3d1fa360253a37021796dc87a0c2e595ad262661a10f85088",
    );
    expect(await digest(new URL("to-tickets/upstream.md", SKILLS_ROOT))).toBe(
      "5c9fba69845c2519b9b35b9af42ae5142c21f8ca15ac2123dc2722002c8058ae",
    );
  }

  /** Proves fixtures cover the ticket's required behavioral outcomes. */
  async function coversRequiredBehavioralFixtures(): Promise<void> {
    const specFixtures = JSON.parse(
      await readFile(new URL("to-spec/behavior-fixtures.json", SKILLS_ROOT), "utf8"),
    ) as BehaviorFixture[];
    const ticketFixtures = JSON.parse(
      await readFile(
        new URL("to-tickets/behavior-fixtures.json", SKILLS_ROOT),
        "utf8",
      ),
    ) as BehaviorFixture[];

    expect(specFixtures.map(readFixtureId)).toEqual([
      "settled-synthesis",
      "minimal-seam-confirmation",
      "read-only",
    ]);
    expect(ticketFixtures.map(readFixtureId)).toEqual([
      "approval-gating",
      "vertical-slicing",
      "relationship-fallback-order",
      "wide-refactor-expand-contract",
    ]);

    const synthesis = specFixtures[0];
    const readOnly = specFixtures[2];
    const approval = ticketFixtures[0];
    const vertical = ticketFixtures[1];
    const fallback = ticketFixtures[2];
    if (!synthesis || !readOnly || !approval || !vertical || !fallback) {
      throw new Error("Expected specification and ticket behavior fixtures");
    }
    expect(synthesis.forbidden).toContain("Begin a fresh requirements interview.");
    expect(readOnly.expected).toContain(
      "State explicitly that the specification was not published.",
    );
    expect(approval.forbidden).toContain("Publish tickets before approval.");
    expect(vertical.expected).toContain(
      "Keep each ticket independently verifiable and sized for one fresh context window.",
    );
    expect(fallback.expected).toEqual([
      "Try native connected GitHub relationships first.",
      "Use authenticated GitHub REST second when native relationship capability is unavailable.",
      "Use explicit Parent and Blocked by Markdown references third.",
      "Keep parent membership distinct from blocking order and report the representation used.",
    ]);
  }

  it("lists and loads both GitHub workflows", listsAndLoadsWorkflows);
  it("preserves relationship fallback order", preservesRelationshipFallbackOrder);
  it("preserves pinned upstream sources", preservesPinnedUpstreamSources);
  it("covers required behavioral fixtures", coversRequiredBehavioralFixtures);
}

describe("to-spec and to-tickets runtimes", defineSpecTicketRuntimeSuite);
