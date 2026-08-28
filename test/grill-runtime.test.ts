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

/** Returns a fixture's stable identifier. */
function readFixtureId(fixture: { id: string }): string {
  return fixture.id;
}

/** Computes the SHA-256 digest of a vendored UTF-8 artifact. */
async function digest(path: URL): Promise<string> {
  const source = await readFile(path, "utf8");
  return createHash("sha256").update(source).digest("hex");
}

/** Defines the lazy grilling and domain-modeling runtime contract tests. */
function defineGrillRuntimeSuite(): void {
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
    client = new Client({ name: "grill-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    return client;
  }

  afterEach(cleanup);

  /** Proves public visibility, hidden loading, and lazy parent composition. */
  async function composesHiddenDependenciesLazily(): Promise<void> {
    const connected = await connect();
    const listing = await connected.callTool({
      name: "list_skills",
      arguments: {},
    });
    expect(listing.structuredContent).toMatchObject({
      skills: expect.arrayContaining([
        {
          name: "grill-with-docs",
          description:
            "Stress-test a plan through evidence-led decisions and durable domain language.",
        },
      ]),
    });
    expect(JSON.stringify(listing)).not.toContain('"name":"grilling"');
    expect(JSON.stringify(listing)).not.toContain('"name":"domain-modeling"');

    const parent = await loadText(connected, "grill-with-docs");
    const grilling = await loadText(connected, "grilling");
    const domain = await loadText(connected, "domain-modeling");
    expect(parent).toContain('load_skill("grilling")');
    expect(parent).toContain('load_skill("domain-modeling")');
    expect(parent).not.toContain("Map the design as a decision tree");
    expect(parent).not.toContain("# Domain Modeling");
    expect(grilling).toContain("Map this as a **design tree**");
    expect(domain).toContain("# Domain Modeling");
  }

  /** Proves the adapted workflows retain ticket #5's behavioral constraints. */
  async function preservesDecisionAndDocumentationBehavior(): Promise<void> {
    const connected = await connect();
    const parent = await loadText(connected, "grill-with-docs");
    const grilling = await loadText(connected, "grilling");
    const domain = await loadText(connected, "domain-modeling");

    expect(parent).toMatch(/facts to\s+investigate/);
    expect(parent).toContain("decisions for the user");
    expect(parent).toMatch(
      /Do not produce a specification or begin\s+implementation/,
    );
    expect(grilling).toContain("Assumption:");
    expect(grilling).toContain("recommended answer");
    expect(grilling).toContain("Material tradeoff");
    expect(grilling).toContain("wait for the user's answers");
    expect(grilling).toContain("frontier");
    expect(domain).toContain("propose a precise canonical term");
    expect(domain).toContain("# CONTEXT.md Format");
    expect(domain).toContain("_Avoid_: Purchase, transaction");
    expect(domain).toContain("# ADR Format");
    expect(domain).toContain("Hard to reverse");
    expect(domain).toContain("Surprising without context");
    expect(domain).toContain("The result of a real trade-off");
    expect(domain).not.toContain("./CONTEXT-FORMAT.md");
    expect(domain).not.toContain("./ADR-FORMAT.md");
  }

  /** Proves all three primary upstream skill sources match their pinned commit. */
  async function preservesPinnedSources(): Promise<void> {
    expect(
      await digest(new URL("grill-with-docs/upstream.md", SKILLS_ROOT)),
    ).toBe("7de372c13488f1ee96cc11cd8907b56b6809cc93eef776eeddd37de6b6cbe3fe");
    expect(await digest(new URL("grilling/upstream.md", SKILLS_ROOT))).toBe(
      "10ff989e7498b23b5acb49d5048f11dcd906757d2f79c5cdf8a00001381296f2",
    );
    expect(await digest(new URL("domain-modeling/upstream.md", SKILLS_ROOT))).toBe(
      "327a2b50620e2fd70abc6893cd6965e76b20f8d0adb0dc2c8d5eb3845efb643e",
    );
  }

  /** Proves the behavior suite covers the ticket's critical failure modes. */
  async function coversBehavioralFixtures(): Promise<void> {
    const source = await readFile(
      new URL("grill-with-docs/behavior-fixtures.json", SKILLS_ROOT),
      "utf8",
    );
    const fixtures = JSON.parse(source) as BehaviorFixture[];
    expect(fixtures.map(readFixtureId)).toEqual([
      "fact-investigation",
      "decision-frontier",
      "stable-domain-language",
      "no-premature-delivery",
    ]);
    const [fact, decision, domain, noDelivery] = fixtures;
    if (!fact || !decision || !domain || !noDelivery) {
      throw new Error("Expected four grilling behavior fixtures");
    }
    expect(fact.forbidden).toContain(
      "Ask the user for a fact the workflow can inspect.",
    );
    expect(decision.expected).toContain(
      "Wait for the user's choices before asking dependent questions.",
    );
    expect(domain.expected).toContain(
      "Persist only the justified glossary change.",
    );
    expect(noDelivery.forbidden).toEqual([
      "Jump directly to a specification.",
      "Begin implementation.",
    ]);
  }

  it("composes hidden dependencies lazily", composesHiddenDependenciesLazily);
  it(
    "preserves decision and documentation behavior",
    preservesDecisionAndDocumentationBehavior,
  );
  it("preserves pinned upstream sources", preservesPinnedSources);
  it("covers behavioral fixtures", coversBehavioralFixtures);
}

describe("grill-with-docs runtime", defineGrillRuntimeSuite);
