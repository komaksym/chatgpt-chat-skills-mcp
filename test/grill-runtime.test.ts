import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { startService, type RunningService } from "../src/service.js";

const SKILLS_ROOT = new URL("../skills/", import.meta.url);

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

/** Returns only the adapted runtime body from a loaded skill response. */
function runtimeBody(loaded: string, name: string): string {
  const marker = `# ${name}\n\n`;
  const start = loaded.indexOf(marker);
  if (start === -1) {
    throw new Error(`Missing runtime marker for ${name}`);
  }
  return loaded.slice(start + marker.length).trimEnd();
}

/** Computes the SHA-256 digest of a vendored UTF-8 artifact. */
async function digest(path: URL): Promise<string> {
  const source = await readFile(path, "utf8");
  return createHash("sha256").update(source).digest("hex");
}

/** Defines upstream-alignment tests through the production MCP HTTP boundary. */
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

  /** Proves public visibility, hidden loading, and immediate parent composition. */
  async function composesHiddenDependenciesImmediately(): Promise<void> {
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
    const upstreamParent = await readFile(
      new URL("grill-with-docs/upstream.md", SKILLS_ROOT),
      "utf8",
    );
    const expectedParent = upstreamParent.replace(
      'Call the Skill tool twice, for "grilling" and "domain-modeling".',
      'Immediately call `load_skill("grilling")` and `load_skill("domain-modeling")` in this conversation.',
    );

    expect(runtimeBody(parent, "grill-with-docs")).toBe(expectedParent.trimEnd());
    expect(parent).not.toContain("Map this as a **design tree**");
    expect(parent).not.toContain("# Domain Modeling");
    expect(runtimeBody(grilling, "grilling")).toContain(
      "Map this as a **design tree**",
    );
    expect(runtimeBody(domain, "domain-modeling")).toContain("# Domain Modeling");
    for (const loaded of [parent, grilling, domain]) {
      expect(loaded).not.toContain("6654f6b60cd9d5be8b54c6fafe44346dabeb3b76");
      expect(loaded).not.toContain("Copyright (c) 2026 Matt Pocock");
      expect(loaded).not.toContain("changeRecords");
    }
  }

  /** Proves grilling differs from upstream only at unavailable fact lookup mechanics. */
  async function preservesGrillingMethodology(): Promise<void> {
    const connected = await connect();
    const loaded = await loadText(connected, "grilling");
    const upstream = await readFile(
      new URL("grilling/upstream.md", SKILLS_ROOT),
      "utf8",
    );
    const upstreamFactLookup =
      "Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.";
    const adaptedFactLookup =
      "Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment, use available connected capabilities to find it; don't ask the user for anything you could look up yourself. An unverified fact is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.";
    expect(upstream).toContain(upstreamFactLookup);
    const expected = upstream.replace(upstreamFactLookup, adaptedFactLookup);

    const runtime = runtimeBody(loaded, "grilling");
    expect(runtime).toBe(expected.trimEnd());
    expect(runtime).toContain("give your recommended answer");
    expect(runtime).toContain("wait for the user's answers");
    expect(runtime).toContain("frontier");
    expect(runtime).toContain("shared understanding");
    expect(runtime).not.toContain("Assumption:");
    expect(runtime).not.toContain("Material tradeoff:");
    expect(runtime).not.toContain("all remaining questions");
    expect(runtime).not.toContain("dispatch a sub-agent");
  }

  /** Proves domain modeling is upstream plus the two exact inlined support documents. */
  async function preservesSelfContainedDomainModeling(): Promise<void> {
    const connected = await connect();
    const loaded = await loadText(connected, "domain-modeling");
    const upstream = await readFile(
      new URL("domain-modeling/upstream.md", SKILLS_ROOT),
      "utf8",
    );
    const contextFormat = await readFile(
      new URL("domain-modeling/CONTEXT-FORMAT.md", SKILLS_ROOT),
      "utf8",
    );
    const adrFormat = await readFile(
      new URL("domain-modeling/ADR-FORMAT.md", SKILLS_ROOT),
      "utf8",
    );
    const expected =
      upstream
        .replace(
          "Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).",
          "Use the `CONTEXT.md` format included below.",
        )
        .replace(
          "Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).",
          "Use the ADR format included below.",
        )
        .trimEnd() +
      "\n\n---\n\n" +
      contextFormat.trimEnd() +
      "\n\n---\n\n" +
      adrFormat.trimEnd();

    const runtime = runtimeBody(loaded, "domain-modeling");
    expect(runtime).toBe(expected);
    expect(runtime).toContain("propose a precise canonical term");
    expect(runtime).toContain("stress-test them with specific scenarios");
    expect(runtime).toContain("check whether the code agrees");
    expect(runtime).toContain("Don't batch these up");
    expect(runtime).toContain("If `CONTEXT-MAP.md` exists, read it to find contexts");
    expect(runtime).toContain("Hard to reverse");
    expect(runtime).toContain("Surprising without context");
    expect(runtime).toContain("The result of a real trade-off");
    expect(runtime).not.toContain("./CONTEXT-FORMAT.md");
    expect(runtime).not.toContain("./ADR-FORMAT.md");
  }

  /** Proves all pinned skill and supporting source artifacts remain exact. */
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
    expect(
      await digest(new URL("domain-modeling/CONTEXT-FORMAT.md", SKILLS_ROOT)),
    ).toBe("17ab16ce783e4d2801ee52fd9acdf550cbf44de65ae76797a93943bbedf22a13");
    expect(
      await digest(new URL("domain-modeling/ADR-FORMAT.md", SKILLS_ROOT)),
    ).toBe("944c92aa790e8fbdc9199640b170979abb8a34ba8d0fe18c2a01a63bce140ca0");
  }

  it("composes hidden dependencies immediately", composesHiddenDependenciesImmediately);
  it("preserves upstream grilling methodology", preservesGrillingMethodology);
  it("preserves self-contained upstream domain modeling", preservesSelfContainedDomainModeling);
  it("preserves pinned upstream sources", preservesPinnedSources);
}

describe("grill-with-docs runtime", defineGrillRuntimeSuite);
