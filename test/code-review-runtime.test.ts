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

/** Loads one skill and returns its public protocol text. */
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

/** Computes the SHA-256 digest of one vendored UTF-8 source artifact. */
async function digest(path: URL): Promise<string> {
  const source = await readFile(path, "utf8");
  return createHash("sha256").update(source).digest("hex");
}

/** Defines the strict two-axis code-review workflow contract. */
function defineCodeReviewRuntimeSuite(): void {
  let service: RunningService | undefined;
  let client: Client | undefined;

  /** Releases protocol and network resources after each test. */
  async function cleanup(): Promise<void> {
    await client?.close();
    await service?.close();
  }

  /** Connects through the production MCP-over-loopback seam. */
  async function connect(): Promise<Client> {
    service = await startService({ port: 0 });
    client = new Client({ name: "code-review-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    return client;
  }

  afterEach(cleanup);

  /** Proves the new public workflow is metadata-discovered and loadable. */
  async function listsAndLoadsCodeReview(): Promise<void> {
    const connected = await connect();
    const listing = await connected.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toMatchObject({
      skills: expect.arrayContaining([
        {
          name: "code-review",
          description:
            "Review a committed GitHub diff on separate Standards and Spec axes with strict child-chat isolation.",
        },
      ]),
    });

    const runtime = await loadText(connected, "code-review");
    expect(runtime).toContain("## Standards");
    expect(runtime).toContain("## Spec");
    expect(runtime).toMatch(/two separate ChatGPT\s+conversations/);
    expect(runtime).not.toMatch(/git diff|git log|git rev-parse|GitLab|\.scratch|`gh`/);
  }

  /** Proves Standards keeps authority classes distinguishable. */
  async function distinguishesStandardsEvidenceClasses(): Promise<void> {
    const connected = await connect();
    const runtime = await loadText(connected, "code-review");
    expect(runtime).toContain("Documented repository rules");
    expect(runtime).toContain("Established repository conventions");
    expect(runtime).toContain("Heuristic smells");
    expect(runtime).toContain("judgement call");
  }

  /** Proves strict isolation stops instead of substituting parent evidence. */
  async function stopsWhenChildGitHubAccessIsUnavailable(): Promise<void> {
    const connected = await connect();
    const runtime = await loadText(connected, "code-review");
    expect(runtime).toContain(
      "Strict review stopped: each child must independently access GitHub; parent-pasted repository evidence is not an acceptable substitute.",
    );
    expect(runtime).toMatch(/explicit\s+user\s+permission/);
    expect(runtime).toContain("NON-ISOLATED REVIEW");
  }

  /** Proves the spec axis uses all committed-scope sources named by the ticket. */
  async function reviewsCommittedScopeAgainstAllSpecSources(): Promise<void> {
    const connected = await connect();
    const runtime = await loadText(connected, "code-review");
    expect(runtime).toContain("originating GitHub issue");
    expect(runtime).toMatch(/committed\s+specification/);
    expect(runtime).toContain("settled user requirements");
    expect(runtime).toContain("pull-request scope");
  }

  /** Proves the source artifact is an exact pinned upstream copy. */
  async function preservesPinnedUpstreamSource(): Promise<void> {
    expect(await digest(new URL("code-review/upstream.md", SKILLS_ROOT))).toBe(
      "47f4e52c21694def9c7c11cbfbf891ca35eac7a93e395797515be3c8a409ae50",
    );
  }

  /** Proves behavioral fixtures explicitly reject fake same-chat isolation. */
  async function rejectsSequentialSameChatIsolation(): Promise<void> {
    const fixtures = JSON.parse(
      await readFile(
        new URL("code-review/behavior-fixtures.json", SKILLS_ROOT),
        "utf8",
      ),
    ) as BehaviorFixture[];
    const isolation = fixtures.find((fixture) => fixture.id === "strict-isolation");
    expect(isolation?.forbidden).toContain(
      "Describe sequential Standards and Spec passes in one conversation as isolated.",
    );
  }

  /** Proves the documented canary is evidence, not a claim of formal proof. */
  async function documentsSyntheticCanaryAndNotExercisedStatus(): Promise<void> {
    const smoke = await readFile(
      new URL("../docs/code-review-strict-smoke.md", import.meta.url),
      "utf8",
    );
    expect(smoke).toMatch(/two-child synthetic canary/i);
    expect(smoke).toContain("confidence evidence, not formal proof");
    expect(smoke).toContain("NOT EXERCISED");
  }

  it("lists and loads strict code-review through the real MCP seam", listsAndLoadsCodeReview);
  it("distinguishes Standards evidence classes", distinguishesStandardsEvidenceClasses);
  it("stops strict review when either child lacks GitHub", stopsWhenChildGitHubAccessIsUnavailable);
  it("checks committed scope against every Spec source", reviewsCommittedScopeAgainstAllSpecSources);
  it("preserves the pinned upstream code-review source", preservesPinnedUpstreamSource);
  it("rejects sequential same-chat isolation", rejectsSequentialSameChatIsolation);
  it("documents the canary and not-exercised outcome", documentsSyntheticCanaryAndNotExercisedStatus);
}

describe("code-review runtime", defineCodeReviewRuntimeSuite);
