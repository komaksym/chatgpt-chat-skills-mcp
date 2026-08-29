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

/** Returns one required section or fails with a useful test error. */
function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
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
    expect(runtime).toContain(
      'The brief: "Report, per file/hunk where relevant, (a) every place the diff violates a documented standard',
    );
    expect(runtime).toContain(
      'The brief: "Report: (a) requirements the spec asked for that are missing or partial;',
    );

    const standards = runtime.indexOf("### 3. Identify the standards sources");
    const children = runtime.indexOf("### 4. Run both reviews in independent child conversations");
    const aggregate = runtime.indexOf("### 5. Aggregate");
    expect(standards).toBeGreaterThan(-1);
    expect(children).toBeGreaterThan(standards);
    expect(aggregate).toBeGreaterThan(children);
  }

  async function rejectsFakeIsolationAndFalseCapabilityClaims(): Promise<void> {
    const runtime = await generateSkillRuntime("code-review");
    expect(runtime).toContain(
      "Requires genuinely independent child-review contexts and reports the axes side by side; strict review stops when equivalent isolation or direct GitHub access is unavailable.",
    );
    expect(runtime).not.toContain("Runs both reviews in parallel sub-agents");
    expect(runtime).toContain(
      "The pinned upstream workflow has no non-isolated fallback branch",
    );
    expect(runtime).toContain(
      "do not substitute sequential Standards and Spec passes in this conversation or label them as isolated child reviews",
    );
    expect(runtime).toContain(
      "shared chat history, parent-pasted repository evidence, or one child's findings",
    );
    expect(runtime).not.toContain("NON-ISOLATED REVIEW");
  }

  async function requiresChromeMcpParallelDispatchAndStrictStop(): Promise<void> {
    const runtime = await generateSkillRuntime("code-review");
    expect(runtime).toContain("@chrome-mcp");
    expect(runtime).toContain(
      "Before sending either review prompt, create all required child conversations",
    );
    expect(runtime).toContain("dispatch both review prompts in parallel");
    expect(runtime).toContain("stop strict review before sending either review prompt");
    expect(runtime).not.toContain(
      "When both axes run and concurrent child execution is available, dispatch them in parallel.",
    );
  }

  async function keepsChildEvidenceDirectAndUncontaminated(): Promise<void> {
    const runtime = await generateSkillRuntime("code-review");
    expect(runtime).toContain(
      "every child can use connected GitHub directly",
    );
    expect(runtime).toContain(
      "Do not inspect or share any child's findings until all child reviews that will run have completed; aggregate only after that.",
    );

    const standardsPrompt = between(
      runtime,
      "**Standards child-review prompt** should include:",
      "**Spec child-review prompt** should include:",
    );
    expect(standardsPrompt).toContain("standards-source paths");
    expect(standardsPrompt).toContain(
      "The child must fetch those repository files itself through connected GitHub.",
    );
    expect(standardsPrompt).toContain(
      "smell baseline from step 3 pasted in full as review methodology",
    );
    expect(standardsPrompt).not.toContain("spec source");
    expect(standardsPrompt).not.toContain("fetched spec contents");

    const specPrompt = between(
      runtime,
      "**Spec child-review prompt** should include:",
      "If the spec is missing, skip the Spec child review",
    );
    expect(specPrompt).toContain("repository or GitHub-issue locator");
    expect(specPrompt).toContain(
      "The child must fetch that evidence itself through connected GitHub",
    );
    expect(specPrompt).not.toContain("standards-source");
    expect(specPrompt).not.toContain("smell baseline");

    expect(standardsPrompt).toContain(
      "Return exactly one single-line plain-text report",
    );
    expect(standardsPrompt).toContain(
      "AXIS=Standards; FINDINGS=<integer>; REPORT=<report>",
    );
    expect(specPrompt).toContain(
      "Return exactly one single-line plain-text report",
    );
    expect(specPrompt).toContain(
      "AXIS=Spec; FINDINGS=<integer>; REPORT=<report>",
    );
  }

  async function preservesUpstreamStopsAndRemoteTranslation(): Promise<void> {
    const runtime = await generateSkillRuntime("code-review");
    expect(runtime).toContain(
      "A bad ref or empty diff should fail here, not inside the independent child reviews.",
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
      "`@chrome-mcp` is the supported child-review",
    );
    expect(smoke).toContain("Arbitrary browser");
    expect(smoke).toContain(
      "two tabs showing the same conversation, or two sequential prompts",
    );
    expect(smoke).toContain("sibling canary literal");
    expect(smoke).not.toContain("Implementation-time result — 2026-08-29\n\n`PASS`");
  }

  it("generates code-review deterministically from pinned upstream", generatesDeterministically);
  it("lists and loads the projected code-review runtime", listsAndLoadsProjectedRuntime);
  it("preserves both axes and upstream process order", preservesAxisMethodologyAndOrder);
  it("rejects fake isolation and false capability claims", rejectsFakeIsolationAndFalseCapabilityClaims);
  it("requires chrome-mcp parallel dispatch and strict stop", requiresChromeMcpParallelDispatchAndStrictStop);
  it("keeps child evidence direct and uncontaminated", keepsChildEvidenceDirectAndUncontaminated);
  it("preserves upstream stop behavior and remote mechanics", preservesUpstreamStopsAndRemoteTranslation);
  it("records the child-conversation smoke result truthfully", recordsSmokeTruthfully);
}

describe("code-review Mechanical Projection", defineCodeReviewRuntimeSuite);
