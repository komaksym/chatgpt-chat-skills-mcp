import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = new URL("../evals/release/", import.meta.url);
const PIN = "6654f6b60cd9d5be8b54c6fafe44346dabeb3b76";
interface RubricCriterion {
  id: string;
  passWhen: string;
  requiresExternalEvidence?: boolean;
  source: {
    upstream: { commit: string; path: string; section: string };
    contract: { issue: number; userStory: number };
  };
}

interface EvaluationCase {
  id: string;
  mode: "paired" | "observation";
  workflow: string;
  model: string;
  task: string;
  prompt: string;
  followUp?: string;
  repositoryContext: {
    sourceRepository: string;
    baseSha: string;
    writes: boolean;
    reset: string;
  };
  capabilities: string[];
  rubric: RubricCriterion[];
}

interface Suite {
  version: number;
  mode: string;
  cases: EvaluationCase[];
}

async function suite(): Promise<Suite> {
  return JSON.parse(await readFile(new URL("cases.json", ROOT), "utf8")) as Suite;
}


function completedRun(data: Suite): Record<string, unknown> {
  const releaseSha = "a".repeat(40);
  return {
    mode: "manual-release",
    runId: "test-run",
    releaseSha,
    cases: data.cases.map((item, index) => {
      const rubric = item.rubric.map((criterion) => ({
        id: criterion.id,
        judgment: "pass",
        evidence: "Observed fixture evidence.",
      }));
      const externalResults = item.rubric.some((criterion) => criterion.requiresExternalEvidence)
        ? ["Observed external fixture result."]
        : [];
      const skillsMcp = {
        repository: "komaksym/chatgpt-chat-skills-mcp",
        releaseSha,
        evidence: "Observed fixture service revision.",
      };
      const repository = {
        sourceRepository: item.repositoryContext.sourceRepository,
        baseSha: item.repositoryContext.baseSha,
      };

      const baseline = item.mode === "paired" ? {
        skill: null,
        model: item.model,
        skillsMcp: { ...skillsMcp },
        repository: { ...repository, url: `https://example.test/baseline-${index}` },
        capabilities: item.capabilities,
        output: "Observed baseline output.",
        externalResults: [...externalResults],
        rubric,
        pass: true,
        rationale: "Baseline fixture completed.",
      } : null;

      return {
        caseId: item.id,
        mode: item.mode,
        task: item.task,
        prompt: item.prompt,
        followUp: item.followUp ?? null,
        baseline,
        adapted: {
          skill: item.workflow,
          model: item.model,
          skillsMcp: { ...skillsMcp },
          repository: { ...repository, url: `https://example.test/adapted-${index}` },
          capabilities: item.capabilities,
          output: "Observed adapted output.",
          externalResults: [...externalResults],
          rubric: rubric.map((entry) => ({ ...entry })),
          pass: true,
          rationale: "Adapted fixture completed.",
        },
        pass: true,
        rationale: "Adapted condition meets the fixed rubric.",
        comparison: "Recorded behavioral delta.",
      };
    }),
  };
}

describe("manual faithful-workflow release evaluations", () => {
  it("defines one paired case and focused observation cases", async () => {
    const data = await suite();
    expect(data.version).toBe(4);
    expect(data.mode).toBe("manual-release-only");
    expect(data.cases).toHaveLength(3);
    expect(data.cases.filter((item) => item.mode === "paired")).toHaveLength(1);
    expect(data.cases.filter((item) => item.mode === "observation")).toHaveLength(2);

    for (const item of data.cases) {
      expect(item.model).toBe("GPT-5.6 Sol");
      expect(item.task.trim()).not.toBe("");
      expect(item.repositoryContext.sourceRepository).toBe("komaksym/chatgpt-chat-skills-mcp");
      expect(item.repositoryContext.baseSha).toMatch(/^[0-9a-f]{40}$/);
      expect(item.repositoryContext.reset.trim()).not.toBe("");
      expect(item.capabilities.length).toBeGreaterThan(0);
      expect(item.prompt.trim()).not.toBe("");
      expect(item.rubric.length).toBeGreaterThan(0);
    }
  });

  it("derives every rubric from pinned upstream plus the adaptation contract", async () => {
    const data = await suite();

    for (const item of data.cases) {
      for (const criterion of item.rubric) {
        expect(criterion.passWhen.trim()).not.toBe("");
        expect(criterion.source.upstream.commit).toBe(PIN);
        expect(criterion.source.upstream.path).toMatch(/\/SKILL\.md$/);
        expect(criterion.source.upstream.path).not.toContain("runtime.md");
        expect(criterion.source.upstream.section.trim()).not.toBe("");
        expect(criterion.source.contract.issue).toBe(1);
        expect(criterion.source.contract.userStory).toBeGreaterThan(0);
      }
    }
  });

  it("covers the agreed high-risk release outcomes", async () => {
    const data = await suite();
    const rubricIds = data.cases.flatMap((item) => item.rubric.map((criterion) => criterion.id));

    expect(rubricIds).toEqual(
      expect.arrayContaining([
        "dependency-timing",
        "ready-for-agent",
        "stop-instead-degrade",
      ]),
    );
    expect(data.cases.find((item) => item.workflow === "to-spec")?.mode).toBe("paired");
    expect(data.cases.find((item) => item.workflow === "grill-with-docs")?.mode).toBe("observation");
    expect(data.cases.find((item) => item.workflow === "code-review")?.mode).toBe("observation");
  });

  it("keeps workflow answers and forbidden product changes out of evaluation inputs", async () => {
    const data = await suite();
    const byWorkflow = new Map(
      data.cases.map((item) => [item.workflow, item.task + "\n" + item.prompt]),
    );

    expect(byWorkflow.get("grill-with-docs")).not.toMatch(
      /inspect repository evidence|distinguish facts from decisions|canonical domain language/i,
    );
    expect(byWorkflow.get("to-spec")).not.toMatch(/includeHidden|ask and wait|requires confirmation/i);
  });

  it("marks criteria that require observed external state", async () => {
    const data = await suite();
    const required = data.cases.flatMap((item) =>
      item.rubric
        .filter((criterion) => criterion.requiresExternalEvidence)
        .map((criterion) => item.workflow + ":" + criterion.id),
    );

    expect(required).toEqual(
      expect.arrayContaining([
        "to-spec:ready-for-agent",
        "to-spec:observed-publication",
        "grill-with-docs:dependency-timing",
        "code-review:stop-instead-degrade",
      ]),
    );
  });

  it("records paired and observation outputs, external results, judgments, and rationale", async () => {
    const template = JSON.parse(
      await readFile(new URL("run-template.json", ROOT), "utf8"),
    ) as Record<string, unknown>;

    expect(template).toMatchObject({
      mode: "manual-release",
      runId: "",
      releaseSha: "",
      cases: [
        {
          caseId: "",
          mode: "paired",
          task: "",
          prompt: "",
          followUp: null,
          baseline: {
            skill: null,
            model: "",
            skillsMcp: { repository: "", releaseSha: "", evidence: "" },
            repository: { url: "", sourceRepository: "", baseSha: "" },
            capabilities: [],
            output: "",
            externalResults: [],
            rubric: [],
            pass: null,
            rationale: "",
          },
          adapted: {
            skill: "",
            model: "",
            skillsMcp: { repository: "", releaseSha: "", evidence: "" },
            repository: { url: "", sourceRepository: "", baseSha: "" },
            capabilities: [],
            output: "",
            externalResults: [],
            rubric: [],
            pass: null,
            rationale: "",
          },
          pass: null,
          rationale: "",
          comparison: "",
        },
      ],
    });
  });


  it("rejects passing externally observed criteria without external results", async () => {
    const data = await suite();
    const directory = await mkdtemp(join(tmpdir(), "release-evals-"));
    const runPath = join(directory, "run.json");
    const validatorPath = fileURLToPath(new URL("validate-run.mjs", ROOT));

    try {
      const run = completedRun(data) as {
        cases: Array<{
          caseId: string;
          adapted: { externalResults: unknown[] };
        }>;
      };
      const toSpec = run.cases.find((item) => item.caseId === "representative-to-spec");
      if (!toSpec) throw new Error("expected to-spec evaluation case");
      toSpec.adapted.externalResults = [];
      await writeFile(runPath, JSON.stringify(run), "utf8");

      const rejected = spawnSync(process.execPath, [validatorPath, runPath], { encoding: "utf8" });
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain("external result");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a variant whose recorded Skills MCP revision differs from the release", async () => {
    const data = await suite();
    const directory = await mkdtemp(join(tmpdir(), "release-evals-"));
    const runPath = join(directory, "run.json");
    const validatorPath = fileURLToPath(new URL("validate-run.mjs", ROOT));

    try {
      const run = completedRun(data) as {
        cases: Array<{
          adapted: { skillsMcp: { releaseSha: string } };
        }>;
      };
      const firstCase = run.cases[0];
      if (!firstCase) throw new Error("expected at least one evaluation case");
      firstCase.adapted.skillsMcp.releaseSha = "b".repeat(40);
      await writeFile(runPath, JSON.stringify(run), "utf8");

      const rejected = spawnSync(process.execPath, [validatorPath, runPath], { encoding: "utf8" });
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain("Skills MCP release SHA");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("validates completed paired and observation records through the CLI boundary", async () => {
    const data = await suite();
    const directory = await mkdtemp(join(tmpdir(), "release-evals-"));
    const runPath = join(directory, "run.json");
    const validatorPath = fileURLToPath(new URL("validate-run.mjs", ROOT));

    try {
      const run = completedRun(data);
      await writeFile(runPath, JSON.stringify(run), "utf8");

      const valid = spawnSync(process.execPath, [validatorPath, runPath], { encoding: "utf8" });
      expect(valid.status).toBe(0);
      expect(valid.stdout).toContain("Validated 3 manual release evaluations.");

      const invalid = run as {
        cases: Array<{ adapted: { capabilities: string[] } }>;
      };
      const firstCase = invalid.cases[0];
      if (!firstCase) throw new Error("expected at least one evaluation case");
      firstCase.adapted.capabilities = ["different capability"];
      await writeFile(runPath, JSON.stringify(invalid), "utf8");

      const rejected = spawnSync(process.execPath, [validatorPath, runPath], { encoding: "utf8" });
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain(
        "capabilities must exactly match the fixed case capabilities",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a baseline record for an observation case", async () => {
    const data = await suite();
    const directory = await mkdtemp(join(tmpdir(), "release-evals-"));
    const runPath = join(directory, "run.json");
    const validatorPath = fileURLToPath(new URL("validate-run.mjs", ROOT));

    try {
      const run = completedRun(data) as {
        cases: Array<{ caseId: string; baseline: unknown }>;
      };
      const observation = run.cases.find((item) => item.caseId === "grill-with-docs-dependency-timing");
      if (!observation) throw new Error("expected dependency-timing observation case");
      observation.baseline = {};
      await writeFile(runPath, JSON.stringify(run), "utf8");

      const rejected = spawnSync(process.execPath, [validatorPath, runPath], { encoding: "utf8" });
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain("baseline must be null for an observation case");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("documents a manual release step without stochastic model calls in CI", async () => {
    const guide = await readFile(new URL("README.md", ROOT), "utf8");
    const validator = await readFile(new URL("validate-run.mjs", ROOT), "utf8");

    expect(guide).toContain("manual/release only");
    expect(guide).toContain("same model receives the same task");
    expect(guide).toContain("pinned upstream");
    expect(guide).toMatch(/Skill Adaptation\s+Contract/);
    expect(guide).toContain("failed or unavailable Live Capability");
    expect(guide).toContain("node evals/release/validate-run.mjs");
    expect(guide).toContain("must not call a model");
    expect(guide).toContain("built from the recorded releaseSha");
    expect(guide).toContain("observed Skills MCP revision");
    expect(validator).toContain("capabilities must exactly match the fixed case capabilities");
    expect(validator).toContain("paired result cannot pass unless the adapted condition passes");
  });
});
