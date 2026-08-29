import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = new URL("../evals/release/", import.meta.url);
const PIN = "6654f6b60cd9d5be8b54c6fafe44346dabeb3b76";
const PUBLIC = [
  "grill-with-docs",
  "to-spec",
  "to-tickets",
  "implement",
  "code-review",
  "improve-codebase-architecture",
  "handoff",
];

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

      return {
        caseId: item.id,
        task: item.task,
        prompt: item.prompt,
        followUp: item.followUp ?? null,
        baseline: {
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
        },
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
  it("fixes comparable paired inputs for every public workflow", async () => {
    const data = await suite();
    expect(data.version).toBe(3);
    expect(data.mode).toBe("manual-release-only");
    expect(data.cases.map((item) => item.workflow).sort()).toEqual([...PUBLIC].sort());

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

  it("keeps one or two representative cases and covers issue 14 outcomes", async () => {
    const data = await suite();
    const counts = new Map<string, number>();
    const rubricIds = data.cases.flatMap((item) => item.rubric.map((criterion) => criterion.id));

    for (const item of data.cases) {
      counts.set(item.workflow, (counts.get(item.workflow) ?? 0) + 1);
    }
    expect([...counts.values()].every((count) => count >= 1 && count <= 2)).toBe(true);
    expect(rubricIds).toEqual(
      expect.arrayContaining([
        "dependency-timing",
        "native-relationships",
        "ready-for-agent",
        "seam-confirmation",
        "stop-instead-degrade",
        "upstream-example",
      ]),
    );
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
    expect(byWorkflow.get("to-tickets")).not.toMatch(
      /tracer-bullet|native hierarchy|blocking relationships|show the complete proposed breakdown|wait;|do not create/i,
    );
    expect(byWorkflow.get("implement")).not.toMatch(
      /sourceRef|provenance upstream commit|non-default feature branch/i,
    );
    expect(byWorkflow.get("code-review")).not.toMatch(
      /two-axis|independent review contexts|sequential passes|pretend a child/i,
    );
    expect(byWorkflow.get("improve-codebase-architecture")).not.toMatch(
      /stop at the upstream user-selection boundary|canonical architecture vocabulary|stop after asking/i,
    );
    expect(byWorkflow.get("handoff")).not.toMatch(
      /suggests next skills|redacts sensitive material|Suggested next workflows|do not carry sensitive material/i,
    );

    const toTickets = data.cases.find((item) => item.workflow === "to-tickets");
    expect(JSON.stringify(toTickets?.repositoryContext)).not.toContain("includeHidden");
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
        "to-tickets:native-relationships",
        "to-tickets:ready-for-agent",
        "to-tickets:upstream-ticket-shape",
        "implement:observed-red-green",
        "implement:verification-cadence",
        "implement:commit-review-current-branch",
      ]),
    );
  });

  it("records comparable outputs, external results, judgments, pass/fail, and rationale", async () => {
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
      const toSpec = run.cases.find((item) => item.caseId === "to-spec-seam-label-example");
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

  it("validates completed paired records through the CLI boundary", async () => {
    const data = await suite();
    const directory = await mkdtemp(join(tmpdir(), "release-evals-"));
    const runPath = join(directory, "run.json");
    const validatorPath = fileURLToPath(new URL("validate-run.mjs", ROOT));

    try {
      const run = completedRun(data);
      await writeFile(runPath, JSON.stringify(run), "utf8");

      const valid = spawnSync(process.execPath, [validatorPath, runPath], { encoding: "utf8" });
      expect(valid.status).toBe(0);
      expect(valid.stdout).toContain("Validated 7 paired manual release evaluations.");

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
