import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { generateSkillRuntime } from "../src/projection.js";
import { startService, type RunningService } from "../src/service.js";

const CODE_REVIEW_ROOT = new URL("../skills/code-review/", import.meta.url);

/** Returns one loaded skill's public protocol text. */
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

/** Defines the strict two-axis Mechanical Projection contract. */
function defineCodeReviewRuntimeSuite(): void {
  let service: RunningService | undefined;
  let client: Client | undefined;

  async function cleanup(): Promise<void> {
    await client?.close();
    await service?.close();
  }

  async function connect(): Promise<Client> {
    service = await startService({ port: 0 });
    client = new Client({ name: "code-review-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );
    return client;
  }

  afterEach(cleanup);

  async function generatesDeterministically(): Promise<void> {
    const upstream = await readFile(new URL("upstream.md", CODE_REVIEW_ROOT), "utf8");
    const committed = await readFile(new URL("runtime.md", CODE_REVIEW_ROOT), "utf8");
    expect(createHash("sha256").update(upstream).digest("hex")).toBe(
      "47f4e52c21694def9c7c11cbfbf891ca35eac7a93e395797515be3c8a409ae50",
    );

    const first = await generateSkillRuntime("code-review");
    const second = await generateSkillRuntime("code-review");
    expect(second).toBe(first);
    expect(committed).toBe(first);
  }

  async function listsAndLoadsProjectedRuntime(): Promise<void> {
    const connected = await connect();
    const listing = await connected.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toMatchObject({
      skills: expect.arrayContaining([
        {
          name: "code-review",
          description:
            "Review a committed GitHub diff on separate Standards and Spec axes with strict independent child contexts.",
        },
      ]),
    });

    const runtime = await loadText(connected, "code-review");
    expect(runtime).toContain("### 3. Identify the standards sources");
    expect(runtime).toContain("### 4. Run both reviews in independent child conversations");
    expect(runtime).toContain("### 5. Aggregate");
  }

  async function preservesAxisMethodologyAndOrder(): Promise<void> {
    const runtime = await generateSkillRuntime("code-review");
    expect(runtime).toContain("- **Standards**:");
    expect(runtime).toContain("- **Spec**:");
    expect(runtime).toContain("**Mysterious Name**");
    expect(runtime).toContain("documented repo standard overrides the baseline");

    const standards = runtime.indexOf("### 3. Identify the standards sources");
    const children = runtime.indexOf("### 4. Run both reviews in independent child conversations");
    const aggregate = runtime.indexOf("### 5. Aggregate");
    expect(standards).toBeGreaterThan(-1);
    expect(children).toBeGreaterThan(standards);
    expect(aggregate).toBeGreaterThan(children);
  }

  async function requiresIsolationAndDirectGitHub(): Promise<void> {
    const runtime = await generateSkillRuntime("code-review");
    expect(runtime).toContain("two distinct child conversations");
    expect(runtime).toContain(
      "Each child must independently resolve the pinned head SHA through connected GitHub",
    );
    expect(runtime).toContain(
      "Do not paste repository files, diffs, issue bodies, or one child's findings into the other child.",
    );
    expect(runtime).toContain(
      "do not describe sequential passes here as isolated",
    );
    expect(runtime).toContain(
      "The pinned upstream workflow defines no non-isolated fallback branch.",
    );
    expect(runtime).not.toContain("NON-ISOLATED REVIEW");
    expect(runtime).not.toContain("reference chat history");
  }

  async function preservesUpstreamStopsAndRemoteTranslation(): Promise<void> {
    const runtime = await generateSkillRuntime("code-review");
    expect(runtime).toContain(
      "A bad ref or empty diff should fail here, not inside the two independent review contexts.",
    );
    expect(runtime).toContain(
      'If the spec is missing, skip the Spec child review and note this in the final report.',
    );
    expect(runtime).not.toContain("git diff <fixed-point>...HEAD");
    expect(runtime).not.toContain("docs/agents/issue-tracker.md");
    expect(runtime).not.toContain("/setup-matt-pocock-skills");
  }

  async function recordsSmokeTruthfully(): Promise<void> {
    const smoke = await readFile(
      new URL("../docs/code-review-strict-smoke.md", import.meta.url),
      "utf8",
    );
    expect(smoke).toContain("Two-child synthetic canary");
    expect(smoke).toContain("NOT EXERCISED");
    expect(smoke).toContain(
      "Generic browser or tab automation is not equivalent.",
    );
  }

  it("generates code-review deterministically from pinned upstream", generatesDeterministically);
  it("lists and loads the projected code-review runtime", listsAndLoadsProjectedRuntime);
  it("preserves both axes and upstream process order", preservesAxisMethodologyAndOrder);
  it("requires independent contexts and direct GitHub", requiresIsolationAndDirectGitHub);
  it("preserves upstream stop behavior and remote mechanics", preservesUpstreamStopsAndRemoteTranslation);
  it("records the child-conversation smoke result truthfully", recordsSmokeTruthfully);
}

describe("code-review Mechanical Projection", defineCodeReviewRuntimeSuite);
