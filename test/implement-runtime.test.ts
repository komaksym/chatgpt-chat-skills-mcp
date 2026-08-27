import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

async function digest(path: URL): Promise<string> {
  return createHash("sha256").update(await readFile(path, "utf8")).digest("hex");
}

async function copyProductionBundle(root: string, name: string): Promise<void> {
  await cp(new URL(`${name}/`, SKILLS_ROOT), join(root, name), { recursive: true });
}

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

  afterEach(cleanup);

  async function exposesImplementAndKeepsTddHidden(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "skills-mcp-implement-"));
    roots.push(root);
    await copyProductionBundle(root, "implement");
    await copyProductionBundle(root, "tdd");
    await copyProductionBundle(root, "code-review");

    service = await startService({ port: 0, skillsRoot: root });
    client = new Client({ name: "implement-runtime-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );

    const listing = await client.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toEqual({
      skills: [
        {
          name: "code-review",
          description:
            "Review a committed GitHub diff on separate Standards and Spec axes with strict child-chat isolation.",
        },
        {
          name: "implement",
          description:
            "Implement one settled GitHub ticket through TDD, observed verification, committed review, and a pull request.",
        },
      ],
    });

    const implement = await loadText(client, "implement");
    const tdd = await loadText(client, "tdd");
    const codeReview = await loadText(client, "code-review");

    expect(implement).toContain("load_skill with the exact canonical name `tdd`");
    expect(implement).toContain("record that commit as `implementation_head`");
    expect(implement).toContain("canonical name `code-review`");
    expect(implement).not.toContain("## Standards");
    expect(tdd).toContain("Tests observe behavior through stable public interfaces");
    expect(codeReview).toContain("## Standards");
    expect(codeReview).toContain("## Spec");
    expect(JSON.stringify(listing)).not.toContain("tdd");
  }

  async function declaresLazyDependenciesAndVisibility(): Promise<void> {
    const implement = JSON.parse(
      await readFile(new URL("implement/provenance.json", SKILLS_ROOT), "utf8"),
    ) as Record<string, unknown>;
    const tdd = JSON.parse(
      await readFile(new URL("tdd/provenance.json", SKILLS_ROOT), "utf8"),
    ) as Record<string, unknown>;

    expect(implement).toMatchObject({
      name: "implement",
      visibility: "public",
      dependencies: ["tdd", "code-review"],
      upstream: {
        repository: "https://github.com/mattpocock/skills",
        location: "skills/engineering/implement/SKILL.md",
        commit: "6654f6b60cd9d5be8b54c6fafe44346dabeb3b76",
      },
    });
    expect(tdd).toMatchObject({
      name: "tdd",
      visibility: "hidden",
      dependencies: [],
      upstream: {
        repository: "https://github.com/mattpocock/skills",
        location: "skills/engineering/tdd/SKILL.md",
        commit: "6654f6b60cd9d5be8b54c6fafe44346dabeb3b76",
      },
    });
  }

  async function preservesPinnedUpstreamSources(): Promise<void> {
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
  }

  async function enforcesCommittedReviewOrder(): Promise<void> {
    const runtime = await readFile(
      new URL("implement/runtime.md", SKILLS_ROOT),
      "utf8",
    );
    const reviewBase = runtime.indexOf(
      "Before changing production code, record the current commit as `review_base`.",
    );
    const tddLoad = runtime.indexOf(
      "load_skill with the exact canonical name `tdd`",
    );
    const implementationCommit = runtime.indexOf(
      "Commit the verified implementation before review.",
    );
    const implementationHead = runtime.indexOf(
      "record that commit as `implementation_head`",
    );
    const reviewLoad = runtime.indexOf("canonical name `code-review`");
    const reviewRange = runtime.indexOf("`review_base...HEAD`");
    const fixCommit = runtime.indexOf(
      "Commit justified review fixes as a later commit.",
    );
    const finalVerification = runtime.indexOf(
      "available verification after review fixes",
    );
    const pullRequest = runtime.indexOf("Open or update the pull request.");

    expect(reviewBase).toBeGreaterThan(-1);
    expect(tddLoad).toBeGreaterThan(reviewBase);
    expect(implementationCommit).toBeGreaterThan(tddLoad);
    expect(implementationHead).toBeGreaterThan(implementationCommit);
    expect(reviewLoad).toBeGreaterThan(implementationHead);
    expect(reviewRange).toBeGreaterThan(reviewLoad);
    expect(fixCommit).toBeGreaterThan(reviewRange);
    expect(finalVerification).toBeGreaterThan(fixCommit);
    expect(pullRequest).toBeGreaterThan(finalVerification);
  }

  async function coversRequiredBehavioralFixtures(): Promise<void> {
    const fixtures = JSON.parse(
      await readFile(
        new URL("implement/behavior-fixtures.json", SKILLS_ROOT),
        "utf8",
      ),
    ) as BehaviorFixture[];

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "settled-scope-no-redesign",
      "review-after-implementation-commit",
      "observed-verification-only",
      "default-branch-protection",
    ]);

    const redesign = fixtures[0];
    const preCommit = fixtures[1];
    const verification = fixtures[2];
    const defaultBranch = fixtures[3];
    if (!redesign || !preCommit || !verification || !defaultBranch) {
      throw new Error("Expected implement behavior fixtures");
    }

    expect(redesign.forbidden).toContain(
      "Restart requirements discovery or redesign a settled ticket.",
    );
    expect(preCommit.forbidden).toContain(
      "Run code-review against uncommitted implementation work.",
    );
    expect(verification.forbidden).toContain(
      "Claim RED, GREEN, tests, typecheck, build, CI, commit, or remote mutation without observing its result.",
    );
    expect(defaultBranch.forbidden).toContain(
      "Treat the implementation request itself as authorization to write directly to the default branch.",
    );
  }

  it("exposes implement and keeps tdd hidden", exposesImplementAndKeepsTddHidden);
  it("declares lazy dependencies and visibility", declaresLazyDependenciesAndVisibility);
  it("preserves pinned upstream sources", preservesPinnedUpstreamSources);
  it("reviews only after the implementation commit", enforcesCommittedReviewOrder);
  it("covers required behavioral fixtures", coversRequiredBehavioralFixtures);
}

describe("implement and tdd runtimes", defineImplementRuntimeSuite);
