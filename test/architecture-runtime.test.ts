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

/** Defines the architecture-opportunity workflow tests. */
function defineArchitectureRuntimeSuite(): void {
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
    client = new Client({ name: "architecture-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    return client;
  }

  afterEach(cleanup);

  /** Proves the public parent and hidden design vocabulary compose lazily. */
  async function exposesOnlyThePublicArchitectureSkill(): Promise<void> {
    const connected = await connect();
    const listing = await connected.callTool({
      name: "list_skills",
      arguments: {},
    });

    expect(listing.structuredContent).toMatchObject({
      skills: expect.arrayContaining([
        {
          name: "improve-codebase-architecture",
          description:
            "Find deepening opportunities in a remote repository and present candidate architecture improvements.",
        },
      ]),
    });
    expect(JSON.stringify(listing)).not.toContain('"name":"codebase-design"');

    const parent = await loadText(connected, "improve-codebase-architecture");
    const design = await loadText(connected, "codebase-design");
    expect(parent).toContain('load_skill("codebase-design")');
    expect(parent).toContain('load_skill("grilling")');
    expect(parent).toContain('load_skill("domain-modeling")');
    expect(parent).not.toContain("# Codebase-design discipline");
    expect(design).toContain("# Codebase-design discipline");
  }

  /** Proves candidate analysis follows issue #9 before any selection. */
  async function preservesCandidateAnalysisBehavior(): Promise<void> {
    const connected = await connect();
    const parent = await loadText(connected, "improve-codebase-architecture");

    for (const term of [
      "module",
      "interface",
      "depth",
      "seam",
      "adapter",
      "leverage",
      "locality",
    ]) {
      expect(parent).toContain(term);
    }
    expect(parent).toContain("commit history");
    expect(parent).toContain("actively changing");
    expect(parent).toContain("canonical domain vocabulary");
    expect(parent).toContain("relevant ADRs");
    expect(parent).toContain("Markdown");
    expect(parent).toContain("direct GitHub access");
    expect(parent).toContain("Do not change production code");
    expect(parent).toContain("wait for the user to select");
    expect(parent).not.toContain("Tailwind");
    expect(parent).not.toContain("Mermaid via CDN");
    expect(parent).not.toContain("architecture-review-");

    const selection = parent.indexOf("After the user selects a candidate");
    expect(selection).toBeGreaterThan(-1);
    expect(parent.indexOf('load_skill("grilling")')).toBeGreaterThan(selection);
    expect(parent.indexOf('load_skill("domain-modeling")')).toBeGreaterThan(
      selection,
    );
  }

  /** Proves both architecture sources are exact copies from the pinned commit. */
  async function preservesPinnedSources(): Promise<void> {
    expect(
      await digest(
        new URL("improve-codebase-architecture/upstream.md", SKILLS_ROOT),
      ),
    ).toBe("d1ac25511a936ff4250a48dbcefda363837d6bb9321b3cba73df99fa37270a75");
    expect(await digest(new URL("codebase-design/upstream.md", SKILLS_ROOT))).toBe(
      "2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2",
    );
  }

  /** Proves fixtures cover the ticket's explicit architecture failure modes. */
  async function coversBehavioralFixtures(): Promise<void> {
    const source = await readFile(
      new URL(
        "improve-codebase-architecture/behavior-fixtures.json",
        SKILLS_ROOT,
      ),
      "utf8",
    );
    const fixtures = JSON.parse(source) as BehaviorFixture[];

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "no-direct-refactor",
      "markdown-default",
      "post-selection-dependencies",
      "child-needs-direct-github",
    ]);
    expect(fixtures[0]?.forbidden).toContain(
      "Change production code during candidate analysis.",
    );
    expect(fixtures[1]?.forbidden).toContain(
      "Create or open an HTML report by default.",
    );
    expect(fixtures[2]?.forbidden).toContain(
      "Load grilling or domain-modeling before the user selects a candidate.",
    );
    expect(fixtures[3]?.forbidden).toContain(
      "Use a child that cannot directly access GitHub.",
    );
  }

  it(
    "exposes only the public architecture skill",
    exposesOnlyThePublicArchitectureSkill,
  );
  it(
    "preserves candidate analysis behavior",
    preservesCandidateAnalysisBehavior,
  );
  it("preserves pinned upstream sources", preservesPinnedSources);
  it("covers behavioral fixtures", coversBehavioralFixtures);
}

describe("improve-codebase-architecture runtime", defineArchitectureRuntimeSuite);
