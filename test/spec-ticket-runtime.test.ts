import { readFile } from "node:fs/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { REMOTE_EXECUTION_CONTRACT } from "../src/contract.js";
import { generateSkillRuntime } from "../src/projection.js";
import { parseSkillProvenance } from "../src/provenance.js";
import { startService, type RunningService } from "../src/service.js";

const SKILLS_ROOT = new URL("../skills/", import.meta.url);

async function committedRuntime(name: string): Promise<string> {
  return readFile(new URL(`${name}/runtime.md`, SKILLS_ROOT), "utf8");
}

async function pinnedUpstream(name: string): Promise<string> {
  return readFile(new URL(`${name}/upstream.md`, SKILLS_ROOT), "utf8");
}

async function projectedFromRecordedChanges(name: string): Promise<string> {
  const source = await pinnedUpstream(name);
  const provenanceSource = await readFile(
    new URL(`${name}/provenance.json`, SKILLS_ROOT),
    "utf8",
  );
  const parsed = parseSkillProvenance(provenanceSource);
  if (!parsed.success || !parsed.data.projection) {
    throw new Error(`Expected Mechanical Projection provenance for ${name}`);
  }

  const { projection } = parsed.data;
  let projected = source;
  for (const [index, record] of projection.changeRecords.entries()) {
    if (
      record.source !== projection.entrypoint ||
      record.transform.type !== "replace-exact"
    ) {
      throw new Error(
        `Unexpected projection change ${index + 1} for focused skill ${name}`,
      );
    }

    const first = source.indexOf(record.transform.match);
    expect(
      first,
      `change ${index + 1} must exist in pinned upstream`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      source.indexOf(record.transform.match, first + 1),
      `change ${index + 1} must be unique in pinned upstream`,
    ).toBe(-1);
    projected = projected.replace(
      record.transform.match,
      record.transform.replacement,
    );
  }

  return projected;
}

describe("to-spec and to-tickets Mechanical Projections", () => {
  let service: RunningService | undefined;
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
    await service?.close();
  });

  it("generates to-spec only from pinned upstream plus the GitHub branch selection", async () => {
    const expected = await projectedFromRecordedChanges("to-spec");
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
    const expected = await projectedFromRecordedChanges("to-tickets");
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
      "If the source was an existing GitHub issue, attach every created ticket to that source issue as a native sub-issue.",
    );
    expect(runtime).toContain(
      "creating the required native sub-issue relationship is the only permitted parent mutation",
    );
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
