import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { generateSkillRuntime } from "../src/projection.js";
import { startService, type RunningService } from "../src/service.js";

const SKILLS_ROOT = new URL("../skills/", import.meta.url);

/** Returns a SHA-256 digest for one exact pinned UTF-8 source. */
async function digest(path: URL): Promise<string> {
  return createHash("sha256").update(await readFile(path, "utf8")).digest("hex");
}

/** Loads one skill through the production MCP seam. */
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

/** Defines issue #9's Mechanical Projection and composition contract. */
function defineArchitectureRuntimeSuite(): void {
  let service: RunningService | undefined;
  let client: Client | undefined;

  async function cleanup(): Promise<void> {
    await client?.close();
    await service?.close();
  }

  async function connect(): Promise<Client> {
    service = await startService({ port: 0 });
    client = new Client({ name: "architecture-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    return client;
  }

  afterEach(cleanup);

  async function generatesBothRuntimesDeterministically(): Promise<void> {
    expect(await digest(new URL("codebase-design/upstream.md", SKILLS_ROOT))).toBe(
      "2c20617f87ec8af6a434859f381b2f061a69b530444e74eb39e78bb016a6d1e2",
    );
    expect(
      await digest(new URL("codebase-design/upstream-deepening.md", SKILLS_ROOT)),
    ).toBe("f3dd099ce99289bd213914d8ee3e2429b78309c3957ca4583f7659551b1d53c1");
    expect(
      await digest(
        new URL("codebase-design/upstream-design-it-twice.md", SKILLS_ROOT),
      ),
    ).toBe("8e740bf98446dbd4dfdc132ac4346d9a7eedaf93de6a495889171cf7f99f16bd");
    expect(
      await digest(
        new URL("improve-codebase-architecture/upstream.md", SKILLS_ROOT),
      ),
    ).toBe("d1ac25511a936ff4250a48dbcefda363837d6bb9321b3cba73df99fa37270a75");
    expect(
      await digest(
        new URL(
          "improve-codebase-architecture/upstream-html-report.md",
          SKILLS_ROOT,
        ),
      ),
    ).toBe("581e8bb5a521e46bbda8ca7e19b15948bed882187108092ebb90c62513b77528");

    for (const name of ["codebase-design", "improve-codebase-architecture"]) {
      const committed = await readFile(
        new URL(`${name}/runtime.md`, SKILLS_ROOT),
        "utf8",
      );
      const first = await generateSkillRuntime(name);
      const second = await generateSkillRuntime(name);
      expect(second).toBe(first);
      expect(committed).toBe(first);
    }
  }

  async function keepsDependenciesSeparateAndCorrectlyTimed(): Promise<void> {
    const connected = await connect();
    const listing = await connected.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toMatchObject({
      skills: expect.arrayContaining([
        {
          name: "improve-codebase-architecture",
          description:
            "Find deepening opportunities in a remote repository and present candidate architecture improvements.",
        },
      ]),
    });
    expect(JSON.stringify(listing)).not.toMatch(/"name":"codebase-design"/);

    const parent = await loadText(connected, "improve-codebase-architecture");
    const design = await loadText(connected, "codebase-design");
    const grilling = await loadText(connected, "grilling");
    const domain = await loadText(connected, "domain-modeling");

    expect(parent).not.toContain("# Codebase Design");
    expect(parent).not.toContain("# Grilling");
    expect(parent).not.toContain("# Domain");
    expect(design).toContain("# Codebase Design");
    expect(grilling.length).toBeGreaterThan(0);
    expect(domain.length).toBeGreaterThan(0);

    const designLoad = parent.indexOf("Load `codebase-design` with `load_skill`");
    const selection = parent.indexOf("Which of these would you like to explore?");
    const grillingLoad = parent.indexOf("load `grilling` with `load_skill`");
    const domainLoad = parent.indexOf("load `domain-modeling` with `load_skill`");

    expect(designLoad).toBeGreaterThan(-1);
    expect(selection).toBeGreaterThan(designLoad);
    expect(grillingLoad).toBeGreaterThan(selection);
    expect(domainLoad).toBeGreaterThan(grillingLoad);
  }

  async function preservesArchitectureVocabularyAndEvidenceRules(): Promise<void> {
    const parent = await generateSkillRuntime("improve-codebase-architecture");
    const design = await generateSkillRuntime("codebase-design");

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
      expect(design).toContain(term);
    }

    expect(parent).toContain("live commit history through connected GitHub capabilities");
    expect(parent).toContain("committed domain glossary (`CONTEXT.md`)");
    expect(parent).toContain("any ADRs in the area");
    expect(parent).toContain("name the missing evidence and stop that affected analysis");
    expect(parent).not.toContain("`git log --oneline`");
  }

  async function preservesCandidateReportAndSelectionBoundary(): Promise<void> {
    const parent = await generateSkillRuntime("improve-codebase-architecture");

    expect(parent).toContain("### 2. Present candidates as a Markdown report");
    expect(parent).toContain("Return the candidate report directly in Markdown");
    expect(parent).toContain("Use a diagram only where it materially clarifies");
    expect(parent).toContain("**Files**");
    expect(parent).toContain("**Problem**");
    expect(parent).toContain("**Solution**");
    expect(parent).toContain("**Benefits**");
    expect(parent).toContain("**Recommendation strength**");
    expect(parent).toContain("**Top recommendation**");
    expect(parent).toContain("do not change production code");
    expect(parent).toContain("Then wait for the user's selection");
    expect(parent).not.toContain("Tailwind via CDN");
    expect(parent).not.toContain("architecture-review-<timestamp>.html");
    expect(parent).not.toContain("HTML-REPORT.md");
  }

  async function keepsChildExplorationTruthfulAndSupportingDocsSelfContained(): Promise<void> {
    const parent = await generateSkillRuntime("improve-codebase-architecture");
    const design = await generateSkillRuntime("codebase-design");

    expect(parent).toContain(
      "if an independent child exploration can directly access GitHub",
    );
    expect(parent).toContain(
      "Otherwise continue the same codebase walk in this conversation",
    );
    expect(design).toContain("# Deepening");
    expect(design).toContain("# Design It Twice");
    expect(design).toContain(
      "only when each child can access the repository directly through connected GitHub capabilities",
    );
    expect(design).toContain(
      "stop this alternative-interface branch rather than simulating parallel independence",
    );
    expect(design).not.toContain("](DEEPENING.md)");
    expect(design).not.toContain("](DESIGN-IT-TWICE.md)");
    expect(design).not.toContain("](SKILL.md)");
  }

  it(
    "generates architecture runtimes deterministically",
    generatesBothRuntimesDeterministically,
  );
  it(
    "keeps architecture dependencies separate and correctly timed",
    keepsDependenciesSeparateAndCorrectlyTimed,
  );
  it(
    "preserves architecture vocabulary and repository evidence rules",
    preservesArchitectureVocabularyAndEvidenceRules,
  );
  it(
    "preserves the Markdown candidate report and selection boundary",
    preservesCandidateReportAndSelectionBoundary,
  );
  it(
    "keeps child exploration truthful and supporting docs self-contained",
    keepsChildExplorationTruthfulAndSupportingDocsSelfContained,
  );
}

describe(
  "architecture analysis Mechanical Projections",
  defineArchitectureRuntimeSuite,
);
