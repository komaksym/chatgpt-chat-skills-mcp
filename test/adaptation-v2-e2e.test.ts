import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { REMOTE_EXECUTION_CONTRACT } from "../src/contract.js";
import { generateSkillRuntime } from "../src/projection.js";
import { parseSkillProvenance } from "../src/provenance.js";
import { startService, type RunningService } from "../src/service.js";

const FIXTURE_ROOT = fileURLToPath(
  new URL("./fixtures/adaptation-v2/", import.meta.url),
);
const SKILLS_ROOT = join(FIXTURE_ROOT, "skills");
const REPRESENTATIVE_ROOT = join(SKILLS_ROOT, "representative-v2");
const MISSING_SUPPORTING_ROOT = join(
  FIXTURE_ROOT,
  "cases",
  "missing-supporting",
);

function extractJavaScript(markdown: string): string {
  const match = markdown.match(/```javascript\n(?<source>[\s\S]*?)\n```/);
  if (!match?.groups?.source) {
    throw new Error("Expected one executable JavaScript helper block.");
  }
  return match.groups.source;
}

function executeHelper(source: string): string[] {
  const context: { input: string[]; output?: string[] } = {
    input: [" Beta ", "alpha", "ALPHA "],
  };
  runInNewContext(`${source}\noutput = normalizeLabels(input);`, context);
  if (!context.output) {
    throw new Error("Deterministic helper did not produce output.");
  }
  return context.output;
}

describe("v2 adaptation contract end to end", () => {
  let service: RunningService | undefined;
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
    await service?.close();
    client = undefined;
    service = undefined;
  });

  it("projects one representative adaptation faithfully and loads it through the production MCP boundary", async () => {
    const source = await readFile(join(REPRESENTATIVE_ROOT, "source.md"), "utf8");
    const helper = await readFile(join(REPRESENTATIVE_ROOT, "helper.md"), "utf8");
    const provenanceSource = await readFile(
      join(REPRESENTATIVE_ROOT, "provenance.json"),
      "utf8",
    );
    const committed = await readFile(
      join(REPRESENTATIVE_ROOT, "runtime.md"),
      "utf8",
    );
    const adaptationSpec = await readFile(
      join(FIXTURE_ROOT, "adaptation-spec.md"),
      "utf8",
    );

    const parsed = parseSkillProvenance(provenanceSource);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("Expected valid representative v2 provenance.");
    }
    expect("sourceProvenance" in parsed.data).toBe(true);
    if (!("sourceProvenance" in parsed.data)) {
      throw new Error("Expected explicit Source Provenance.");
    }
    expect(parsed.data.sourceProvenance).toEqual({ type: "absent" });
    expect(Object.keys(parsed.data.sourceProvenance)).toEqual(["type"]);

    const first = await generateSkillRuntime("representative-v2", {
      repositoryRoot: FIXTURE_ROOT,
      skillsRoot: SKILLS_ROOT,
    });
    const second = await generateSkillRuntime("representative-v2", {
      repositoryRoot: FIXTURE_ROOT,
      skillsRoot: SKILLS_ROOT,
    });
    expect(first).toBe(committed);
    expect(second).toBe(first);

    const records = parsed.data.projection.changeRecords;
    const recordFor = (constraint: string) =>
      records.find((record) =>
        record.evidence.constraints.some((value) => value === constraint),
      );

    for (const constraint of [
      "chatgpt-sandbox",
      "connected-github",
      "chrome-browser-mcp",
      "chatgpt-child-workers",
    ]) {
      const record = recordFor(constraint);
      expect(record, `missing ${constraint} Change Record`).toBeDefined();
      if (!record || record.transform.type !== "replace-exact") {
        throw new Error(`Expected replace-exact Change Record for ${constraint}.`);
      }
      expect(first).not.toContain(record.transform.match);
      expect(first).toContain(record.transform.replacement);
    }

    const gitRecord = recordFor("connected-github");
    expect(gitRecord?.allowedRuntimeChange).toBe("translate-invocation-or-tool");

    const chromeRecord = recordFor("chrome-browser-mcp");
    expect(chromeRecord?.transform).toMatchObject({
      replacement: expect.stringMatching(/existing Chrome session.*Chrome Browser MCP/i),
    });

    const workerRecord = recordFor("chatgpt-child-workers");
    expect(workerRecord?.transform).toMatchObject({
      replacement: expect.stringMatching(
        /genuinely independent ChatGPT child workers.*Live Capability.*isolation.*parallelism.*otherwise stop/is,
      ),
    });

    const nativeRecords = records.filter((record) =>
      record.evidence.constraints.some(
        (value) => value === "no-native-application-control",
      ),
    );
    expect(nativeRecords).toHaveLength(2);
    expect(nativeRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allowedRuntimeChange: "select-upstream-supported-branch",
          transform: expect.objectContaining({
            replacement: expect.stringMatching(
              /GitHub storage does not prove.*Repository Asset.*stop only the export operation/is,
            ),
          }),
        }),
        expect.objectContaining({
          allowedRuntimeChange: "select-upstream-supported-branch",
          transform: expect.objectContaining({
            replacement: expect.stringMatching(
              /no Equivalent Mechanism.*stop only the notification operation/is,
            ),
          }),
        }),
      ]),
    );

    const helperRecord = recordFor("only-load-skill-and-list-skills");
    expect(helperRecord).toMatchObject({
      allowedRuntimeChange: "inline-supporting-document",
      source: "helper.md",
      transform: { type: "append-source" },
    });
    const upstreamHelper = extractJavaScript(helper);
    const projectedHelper = extractJavaScript(first);
    expect(projectedHelper).toBe(upstreamHelper);
    expect(executeHelper(upstreamHelper)).toEqual(["alpha", "alpha", "beta"]);
    expect(executeHelper(projectedHelper)).toEqual(["alpha", "alpha", "beta"]);

    const dependencyTiming =
      "Immediately before scoring, invoke Dependency Skill `fixture-dependency`; do not inline its methodology.";
    expect(parsed.data.dependencies).toEqual(["fixture-dependency"]);
    expect(source).toContain(dependencyTiming);
    expect(first).toContain(dependencyTiming);
    expect(adaptationSpec).toMatch(
      /fixture-dependency[\s\S]{0,240}must be available[\s\S]{0,160}may require its own adaptation/i,
    );

    const methodologyTemptation =
      "Prefer the first acceptable label even when a later label would read better.";
    expect(source).toContain(methodologyTemptation);
    expect(first).toContain(methodologyTemptation);
    expect(
      records.some(
        (record) =>
          record.transform.type === "replace-exact" &&
          record.transform.match.includes(methodologyTemptation),
      ),
    ).toBe(false);

    await expect(
      access(join(REPRESENTATIVE_ROOT, "assets", "report.key")),
    ).resolves.toBeUndefined();
    expect(adaptationSpec).toMatch(
      /GitHub storage[\s\S]{0,180}does not prove[\s\S]{0,180}consum/i,
    );
    expect(first).toMatch(/stop only the export operation/i);

    service = await startService({ port: 0, skillsRoot: SKILLS_ROOT });
    client = new Client({ name: "v2-adaptation-e2e", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("/mcp", service.url)),
    );

    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
      "load_skill",
      "list_skills",
    ]);
    const listing = await client.callTool({ name: "list_skills", arguments: {} });
    expect(listing.structuredContent).toEqual({
      skills: [
        {
          name: "representative-v2",
          description: "Exercise representative Codex-to-ChatGPT Web adaptations.",
        },
      ],
    });

    const loaded = CallToolResultSchema.parse(
      await client.callTool({
        name: "load_skill",
        arguments: { name: "representative-v2" },
      }),
    );
    const block = loaded.content[0];
    if (!block || block.type !== "text") {
      throw new Error("Expected text Generated Runtime from load_skill.");
    }
    expect(block.text).toBe(
      `${REMOTE_EXECUTION_CONTRACT}\n\n# representative-v2\n\n${committed.trim()}\n`,
    );
    expect(block.text).not.toContain(provenanceSource.trim());

    const dependencyRuntime = await readFile(
      join(SKILLS_ROOT, "fixture-dependency", "runtime.md"),
      "utf8",
    );
    expect(block.text).not.toContain(dependencyRuntime.trim());

    const hiddenDependency = CallToolResultSchema.parse(
      await client.callTool({
        name: "load_skill",
        arguments: { name: "fixture-dependency" },
      }),
    );
    const hiddenBlock = hiddenDependency.content[0];
    if (!hiddenBlock || hiddenBlock.type !== "text") {
      throw new Error("Expected text Generated Runtime for hidden Dependency Skill.");
    }
    expect(hiddenBlock.text).toBe(
      `${REMOTE_EXECUTION_CONTRACT}\n\n# fixture-dependency\n\n${dependencyRuntime.trim()}\n`,
    );
  });

  it("stops a missing required Supporting Document before a complete Adaptation Spec exists", async () => {
    const source = await readFile(join(MISSING_SUPPORTING_ROOT, "source.md"), "utf8");
    expect(source).toContain("rules.md");

    await expect(
      access(join(MISSING_SUPPORTING_ROOT, "rules.md")),
    ).rejects.toThrow();
    await expect(
      access(join(MISSING_SUPPORTING_ROOT, "adaptation-spec.md")),
    ).rejects.toThrow();

    const stop = await readFile(join(MISSING_SUPPORTING_ROOT, "stop.txt"), "utf8");
    expect(stop).toMatch(/Stopped before producing an Adaptation Spec/i);
    expect(stop).toContain("rules.md");
  });
});
