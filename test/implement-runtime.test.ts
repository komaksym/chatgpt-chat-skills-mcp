import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { generateSkillRuntime } from "../src/projection.js";
import { startService, type RunningService } from "../src/service.js";

const SKILLS_ROOT = new URL("../skills/", import.meta.url);
const OTHER_PIN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

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

/** Copies one production bundle into an isolated generation fixture. */
async function copyBundle(root: string, name: string): Promise<void> {
  await cp(new URL(`${name}/`, SKILLS_ROOT), join(root, name), { recursive: true });
}

/** Defines issue #8's Mechanical Projection and composition contract. */
function defineImplementRuntimeSuite(): void {
  const roots: string[] = [];
  let service: RunningService | undefined;
  let client: Client | undefined;

  async function cleanup(): Promise<void> {
    await client?.close();
    await service?.close();
    for (const root of roots) {
      await rm(root, { recursive: true, force: true });
    }
  }

  async function connect(): Promise<Client> {
    service = await startService({ port: 0 });
    client = new Client({ name: "implement-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    return client;
  }

  async function fixtureRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "implement-projection-"));
    roots.push(root);
    await copyBundle(root, "implement");
    await copyBundle(root, "code-review");
    return root;
  }

  afterEach(cleanup);

  async function generatesBothRuntimesDeterministically(): Promise<void> {
    expect(await digest(new URL("implement/upstream.md", SKILLS_ROOT))).toBe(
      "6d3fd9e83b8f36e5213854779db49b256a457a7ebb4a503e53fa7dcff696adc3",
    );
    expect(await digest(new URL("tdd/upstream.md", SKILLS_ROOT))).toBe(
      "cb01f66bebfaa25fa1f88e6b7e769cd9fd9f35b1120b8563749820738814c927",
    );
    expect(await digest(new URL("tdd/upstream-tests.md", SKILLS_ROOT))).toBe(
      "859f9e592c188fda4fc7277dd180e4ce9c7a2e13f6efe1f6f29eccc9d28c106a",
    );
    expect(await digest(new URL("tdd/upstream-mocking.md", SKILLS_ROOT))).toBe(
      "3ceb807fdf4a47d6a93d4d9a891e5ba6d362a6247bd08adc451feebfc17361ef",
    );

    for (const name of ["implement", "tdd"]) {
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

  async function keepsDependenciesSeparateAndTimed(): Promise<void> {
    const connected = await connect();
    const listing = await connected.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toMatchObject({
      skills: expect.arrayContaining([
        {
          name: "implement",
          description:
            "Implement one settled GitHub ticket through TDD, observed verification, committed review, and a pull request.",
        },
      ]),
    });

    const implement = await loadText(connected, "implement");
    const tdd = await loadText(connected, "tdd");
    const review = await loadText(connected, "code-review");

    expect(JSON.stringify(listing)).not.toMatch(/"name":"tdd"/);
    expect(implement).not.toContain("# Test-Driven Development");
    expect(implement).not.toContain("## Standards");
    expect(implement).not.toContain("## Spec");
    expect(tdd).toContain("# Test-Driven Development");
    expect(review).toContain("## Standards");
    expect(review).toContain("## Spec");

    const reviewBase = implement.indexOf(
      "record the current feature-branch head as `review_base`",
    );
    const tddLoad = implement.indexOf("Use `tdd` with `load_skill`");
    const implementationCommit = implement.indexOf(
      "first commit the verified implementation to the current feature branch",
    );
    const reviewLoad = implement.indexOf(
      "load `code-review` with `load_skill`",
    );
    const fixedPoint = implement.indexOf(
      "from the recorded `review_base` to that implementation commit",
    );
    const reviewFixCommit = implement.indexOf(
      "After review, commit only justified review fixes",
    );
    const pullRequest = implement.indexOf("then open or update the pull request");

    expect(reviewBase).toBeGreaterThan(-1);
    expect(tddLoad).toBeGreaterThan(reviewBase);
    expect(implementationCommit).toBeGreaterThan(tddLoad);
    expect(reviewLoad).toBeGreaterThan(implementationCommit);
    expect(fixedPoint).toBeGreaterThan(reviewLoad);
    expect(reviewFixCommit).toBeGreaterThan(fixedPoint);
    expect(pullRequest).toBeGreaterThan(reviewFixCommit);
  }

  async function preservesTddLoopAndSupportingMethodology(): Promise<void> {
    const tdd = await generateSkillRuntime("tdd");
    expect(tdd).toContain("**Red before green.**");
    expect(tdd).toContain("then only enough code to pass it");
    expect(tdd).toContain("**One slice at a time.**");
    expect(tdd).toContain("**Refactoring is not part of the loop.**");
    expect(tdd).toContain("# Good and Bad Tests");
    expect(tdd).toContain("# When to Mock");
    expect(tdd).toContain("Mock at **system boundaries** only");
    expect(tdd).toContain(
      "Claim RED or GREEN only after observing the corresponding execution result",
    );
  }

  async function requiresObservedResultsAndProtectsDefaultBranch(): Promise<void> {
    const implement = await generateSkillRuntime("implement");
    expect(implement).toContain(
      "Do not mutate the repository default branch unless the upstream workflow and an explicit user instruction authorize that direct mutation",
    );
    expect(implement).toContain(
      "Claim a typecheck, test, build, or CI result only after observing its returned result",
    );
    expect(implement).toContain(
      "Claim commits, pushes, checks, reviews, pull requests, and their statuses only after observing the corresponding results",
    );
    expect(implement).toContain(
      "stop the mutation and report what remains incomplete",
    );
    expect(implement).toContain(
      "stop that verification step and report it as not observed",
    );
  }

  async function expiresFixWhenImplementPinChanges(): Promise<void> {
    const root = await fixtureRoot();
    const path = join(root, "implement", "provenance.json");
    const provenance = JSON.parse(await readFile(path, "utf8")) as {
      upstream: { commit: string };
    };
    provenance.upstream.commit = OTHER_PIN;
    await writeFile(path, JSON.stringify(provenance, null, 2), "utf8");

    await expect(
      generateSkillRuntime("implement", { skillsRoot: root }),
    ).rejects.toThrow(
      "Temporary Upstream Fix for implement expired when the upstream pin changed.",
    );
  }

  async function expiresFixWhenCodeReviewPinChanges(): Promise<void> {
    const root = await fixtureRoot();
    const path = join(root, "code-review", "provenance.json");
    const provenance = JSON.parse(await readFile(path, "utf8")) as {
      upstream: { commit: string };
    };
    provenance.upstream.commit = OTHER_PIN;
    await writeFile(path, JSON.stringify(provenance, null, 2), "utf8");

    await expect(
      generateSkillRuntime("implement", { skillsRoot: root }),
    ).rejects.toThrow(
      "Temporary Upstream Fix for implement expired when dependency code-review upstream pin changed.",
    );
  }

  async function documentsTheQuarantinedContradiction(): Promise<void> {
    const adr = await readFile(
      new URL("../docs/adr/implement-review-order.md", import.meta.url),
      "utf8",
    );
    expect(adr).toContain("review first and\ncommit second");
    expect(adr).toContain("Temporary Upstream Fix");
    expect(adr).toContain("Generation must fail if either pin changes.");
  }

  it("generates implement and tdd deterministically", generatesBothRuntimesDeterministically);
  it("keeps tdd and code-review separate and correctly timed", keepsDependenciesSeparateAndTimed);
  it("preserves behavior-first RED/GREEN TDD methodology", preservesTddLoopAndSupportingMethodology);
  it("requires observed results and protects the default branch", requiresObservedResultsAndProtectsDefaultBranch);
  it("expires the review-order fix when implement pin changes", expiresFixWhenImplementPinChanges);
  it("expires the review-order fix when code-review pin changes", expiresFixWhenCodeReviewPinChanges);
  it("documents the quarantined review-order contradiction", documentsTheQuarantinedContradiction);
}

describe("implement and tdd Mechanical Projections", defineImplementRuntimeSuite);
