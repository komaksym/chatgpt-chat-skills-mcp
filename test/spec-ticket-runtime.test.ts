import { readFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { REMOTE_EXECUTION_CONTRACT } from "../src/contract.js";
import { generateSkillRuntime } from "../src/projection.js";
import { startService, type RunningService } from "../src/service.js";

const SKILLS_ROOT = new URL("../skills/", import.meta.url);

interface ExactChange {
  match: string;
  replacement: string;
}

const SPEC_CHANGES: ExactChange[] = [
  {
    match:
      "The issue tracker and triage label vocabulary should have been provided to you. If not, tell the user to run \`/setup-matt-pocock-skills\`.",
    replacement:
      "Use GitHub Issues in the active repository as the configured project issue tracker.",
  },
  {
    match:
      "3. Write the spec using the template below, then publish it to the project issue tracker. Apply the \`ready-for-agent\` triage label - no need for additional triage.",
    replacement:
      "3. Write the spec using the template below, then publish it as a GitHub issue in the active repository. Apply the \`ready-for-agent\` triage label - no need for additional triage.",
  },
];

const TICKET_CHANGES: ExactChange[] = [
  {
    match:
      "description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured tracker (edges as text in one file per ticket locally, or native blocking links on a real tracker).",
    replacement:
      "description: Break a plan, spec, or the current conversation into tracer-bullet GitHub issues, each declaring its blocking edges and published with native GitHub relationships.",
  },
  {
    match:
      "The issue tracker and triage label vocabulary should have been provided to you. If not, tell the user to run \`/setup-matt-pocock-skills\`.",
    replacement:
      "Use GitHub Issues in the active repository as the configured project issue tracker.",
  },
  {
    match: "Iterate until the user approves the breakdown.",
    replacement:
      "Iterate until the user explicitly approves the complete breakdown. Do not create or change any GitHub issue before that approval.",
  },
  {
    match:
      "Publish the approved tickets. **How** depends on the tracker \`/setup-matt-pocock-skills\` configured; the tickets are the same either way, only the shape of the blocking edges changes:",
    replacement:
      "Publish the approved tickets to GitHub Issues in the active repository. The ticket content is unchanged; this Target Runtime Profile selects the upstream real-tracker GitHub path:",
  },
  {
    match:
      "- **Local files** → write one file per ticket under \`.scratch/<feature-slug>/issues/<NN>-<slug>.md\`, numbered from \`01\` in dependency order (blockers first). Each file's \"Blocked by\" lists the numbers/titles it depends on. Use the per-ticket file template below: one ticket per file, never a single combined file.\n- **A real issue tracker (GitHub, Linear, …)** → publish one issue per ticket in dependency order (blockers first) so each ticket's blocking edges can reference real identifiers. Use the platform's native blocking / sub-issue relationship where it has one; otherwise set each ticket's \"Blocked by\" to the blocking issues. Apply the \`ready-for-agent\` triage label unless instructed otherwise; the tickets are agent-grabbable by construction.",
    replacement:
      "- **GitHub Issues** → publish one issue per ticket in dependency order (blockers first) so each ticket's blocking edges can reference real identifiers. Parent/sub-issue membership represents scope; blocking relationships represent start-order dependency. Create them separately as native GitHub relationships whenever both are required. Use a connected native GitHub relationship capability first; otherwise use another live authenticated GitHub mechanism, such as GitHub REST, that creates that exact native relationship. Markdown \`## Parent\` or \`## Blocked by\` text is descriptive only and never substitutes for a required native relationship. If no live mechanism can create a required relationship, stop the affected mutation and report exactly what remains incomplete. Apply the \`ready-for-agent\` triage label unless instructed otherwise; the tickets are agent-grabbable by construction.",
  },
  {
    match:
      "<local-ticket-template>\n\n# <NN>: <Ticket title>\n\n**What to build:** the end-to-end behaviour this ticket makes work, from the user's perspective, not a layer-by-layer implementation list.\n\n**Blocked by:** the numbers/titles of the tickets that gate this one, or \"None (can start immediately)\".\n\n**Status:** ready-for-agent\n\n- [ ] Acceptance criterion 1\n- [ ] Acceptance criterion 2\n\n</local-ticket-template>\n\n",
    replacement: "",
  },
  {
    match: "In either form, avoid specific file paths or code snippets:",
    replacement: "In GitHub issues, avoid specific file paths or code snippets:",
  },
];

function projectExactly(source: string, changes: ExactChange[]): string {
  let projected = source;
  for (const [index, change] of changes.entries()) {
    const first = source.indexOf(change.match);
    expect(first, `change ${index + 1} must exist in pinned upstream`).toBeGreaterThanOrEqual(0);
    expect(
      source.indexOf(change.match, first + 1),
      `change ${index + 1} must be unique in pinned upstream`,
    ).toBe(-1);
    projected = projected.replace(change.match, change.replacement);
  }
  return projected;
}

async function committedRuntime(name: string): Promise<string> {
  return readFile(new URL(`${name}/runtime.md`, SKILLS_ROOT), "utf8");
}

async function pinnedUpstream(name: string): Promise<string> {
  return readFile(new URL(`${name}/upstream.md`, SKILLS_ROOT), "utf8");
}

describe("to-spec and to-tickets Mechanical Projections", () => {
  let service: RunningService | undefined;
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
    await service?.close();
  });

  it("generates to-spec only from pinned upstream plus the GitHub branch selection", async () => {
    const upstream = await pinnedUpstream("to-spec");
    const expected = projectExactly(upstream, SPEC_CHANGES);
    const first = await generateSkillRuntime("to-spec");
    const second = await generateSkillRuntime("to-spec");

    expect(first).toBe(expected);
    expect(second).toBe(first);
    expect(await committedRuntime("to-spec")).toBe(expected);
  });

  it("preserves to-spec synthesis, seam confirmation, and ready-for-agent publication", async () => {
    const runtime = await committedRuntime("to-spec");

    expect(runtime).toContain(
      "Do NOT interview the user; just synthesize what you already know.",
    );
    expect(runtime).toContain("Use the highest seam possible.");
    expect(runtime).toContain(
      "Check with the user that these seams match their expectations.",
    );
    expect(runtime).toContain("Apply the `ready-for-agent` triage label");
  });

  it("generates to-tickets only from pinned upstream plus recorded GitHub changes", async () => {
    const upstream = await pinnedUpstream("to-tickets");
    const expected = projectExactly(upstream, TICKET_CHANGES);
    const first = await generateSkillRuntime("to-tickets");
    const second = await generateSkillRuntime("to-tickets");

    expect(first).toBe(expected);
    expect(second).toBe(first);
    expect(await committedRuntime("to-tickets")).toBe(expected);
  });

  it("preserves vertical slicing and gates native GitHub mutations on approval and capability", async () => {
    const runtime = await committedRuntime("to-tickets");

    expect(runtime).toContain(
      "Each slice cuts a narrow but COMPLETE path through every layer",
    );
    expect(runtime).toContain("sequence it as **expand–contract**");
    expect(runtime).toContain(
      "Do not create or change any GitHub issue before that approval.",
    );
    expect(runtime).toContain("Parent/sub-issue membership represents scope");
    expect(runtime).toContain(
      "blocking relationships represent start-order dependency",
    );
    expect(runtime).toContain(
      "stop the affected mutation and report exactly what remains incomplete",
    );
    expect(runtime).not.toContain(".scratch/");
    expect(runtime).not.toContain("Linear");
  });

  it("lists and loads both generated runtimes through the production MCP boundary", async () => {
    service = await startService({ port: 0 });
    client = new Client({ name: "spec-ticket-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );

    const listing = await client.callTool({ name: "list_skills", arguments: {} });
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

    for (const name of ["to-spec", "to-tickets"]) {
      const loaded = CallToolResultSchema.parse(
        await client.callTool({ name: "load_skill", arguments: { name } }),
      );
      const block = loaded.content[0];
      if (!block || block.type !== "text") {
        throw new Error(`Expected text runtime for ${name}`);
      }
      const runtime = await committedRuntime(name);
      expect(block.text).toBe(
        `${REMOTE_EXECUTION_CONTRACT}\n\n# ${name}\n\n${runtime.trim()}\n`,
      );
      expect(block.text).not.toContain(
        "6654f6b60cd9d5be8b54c6fafe44346dabeb3b76",
      );
      expect(block.text).not.toContain("changeRecords");
    }
  });
});
