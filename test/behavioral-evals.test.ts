import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

interface RubricCriterion {
  description: string;
  id: string;
}

interface BehavioralCase {
  id: string;
  justification?: string;
  prompt: string;
  repositoryContext: {
    baseSha: string;
    setup: string;
    sourceRepository: string;
    writes: boolean;
  };
  rubric: RubricCriterion[];
  workflow: string;
}

interface BehavioralSuite {
  cases: BehavioralCase[];
  mode: string;
}

const CASES_PATH = join(process.cwd(), "evals", "behavioral", "cases.json");
const VALIDATOR_PATH = join(
  process.cwd(),
  "evals",
  "behavioral",
  "validate-run.mjs",
);

const tempRoots: string[] = [];

async function loadSuite(): Promise<BehavioralSuite> {
  return JSON.parse(await readFile(CASES_PATH, "utf8")) as BehavioralSuite;
}

function rubricIds(cases: BehavioralCase[], workflow: string): Set<string> {
  return new Set(
    cases
      .filter((candidate) => candidate.workflow === workflow)
      .flatMap((candidate) => candidate.rubric.map((criterion) => criterion.id)),
  );
}

function makeCompletedRun(suite: BehavioralSuite): Record<string, unknown> {
  const releaseSha = "a".repeat(40);
  const model = "GPT-5.6 Sol";
  return {
    runId: "release-candidate-1",
    mode: "manual-release",
    releaseSha,
    model,
    cases: suite.cases.map((candidate) => {
      const baselineRubric = Object.fromEntries(
        candidate.rubric.map((criterion) => [criterion.id, "fail"]),
      );
      const adaptedRubric = Object.fromEntries(
        candidate.rubric.map((criterion) => [criterion.id, "pass"]),
      );
      return {
        caseId: candidate.id,
        prompt: candidate.prompt,
        baseline: {
          skill: null,
          model,
          repository: {
            url: "https://github.com/example/baseline-fixture",
            sourceRepository: candidate.repositoryContext.sourceRepository,
            baseSha: candidate.repositoryContext.baseSha,
          },
          outcome: "Baseline outcome recorded from the fresh no-skill conversation.",
          rubric: baselineRubric,
        },
        adapted: {
          skill: candidate.workflow,
          model,
          repository: {
            url: "https://github.com/example/adapted-fixture",
            sourceRepository: candidate.repositoryContext.sourceRepository,
            baseSha: candidate.repositoryContext.baseSha,
          },
          outcome: "Adapted outcome recorded from the fresh skill conversation.",
          rubric: adaptedRubric,
        },
        pass: true,
        rationale: "The adapted run met the fixed rubric and improved the intended behavior.",
      };
    }),
  };
}

async function writeRun(run: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "behavioral-eval-"));
  tempRoots.push(root);
  const path = join(root, "run.json");
  await writeFile(path, JSON.stringify(run, null, 2), "utf8");
  return path;
}

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("behavioral release evaluation pack", () => {
  it("stays manual-only and keeps one or two cases per workflow by default", async () => {
    const suite = await loadSuite();
    const expected = [
      "code-review",
      "grill-with-docs",
      "handoff",
      "implement",
      "improve-codebase-architecture",
      "setup-matt-pocock-skills",
      "to-spec",
      "to-tickets",
    ];

    expect(suite.mode).toBe("manual-release-only");
    expect([...new Set(suite.cases.map((candidate) => candidate.workflow))].sort()).toEqual(
      expected,
    );
    for (const workflow of expected) {
      const cases = suite.cases.filter(
        (candidate) => candidate.workflow === workflow,
      );
      expect(cases.length).toBeGreaterThanOrEqual(1);
      for (const extra of cases.slice(2)) {
        expect(extra.justification).toMatch(
          /^(regression|uncovered-behavior):/,
        );
      }
    }
  });

  it("covers every issue 14 workflow behavior in fixed rubrics", async () => {
    const suite = await loadSuite();
    const required: Record<string, string[]> = {
      "grill-with-docs": [
        "fact-investigation",
        "decision-question",
        "recommendation",
        "domain-vocabulary",
      ],
      "to-spec": ["synthesize-without-reinterview"],
      "to-tickets": [
        "approval-gate",
        "vertical-slices",
        "explicit-blockers",
        "no-horizontal-decomposition",
      ],
      implement: [
        "lazy-tdd",
        "feature-branch-pr",
        "observed-verification-only",
        "commit-before-review",
      ],
      "code-review": [
        "separate-standards-spec",
        "direct-child-github",
        "refuse-fake-isolation",
      ],
      "improve-codebase-architecture": [
        "depth-seam-locality-leverage",
        "markdown-output",
        "no-code-changes",
        "wait-for-selection",
      ],
      handoff: [
        "concise-continuity",
        "durable-references",
        "next-action",
        "suggested-skills",
        "secret-redaction",
      ],
      "setup-matt-pocock-skills": [
        "github-first-access",
        "minimal-evidence-backed-domain-structure",
      ],
    };

    for (const [workflow, ids] of Object.entries(required)) {
      const actual = rubricIds(suite.cases, workflow);
      for (const id of ids) expect(actual.has(id)).toBe(true);
    }
  });

  it("accepts a completed paired run through the manual validator", async () => {
    const suite = await loadSuite();
    const runPath = await writeRun(makeCompletedRun(suite));

    const result = spawnSync(process.execPath, [VALIDATOR_PATH, runPath], {
      encoding: "utf8",
    });

    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: "",
    });
  });

  it("rejects baseline and adapted runs that use different models", async () => {
    const suite = await loadSuite();
    const run = makeCompletedRun(suite);
    const cases = run.cases as Array<Record<string, unknown>>;
    const first = cases[0]!;
    const adapted = first.adapted as Record<string, unknown>;
    adapted.model = "different-model";
    const runPath = await writeRun(run);

    const result = spawnSync(process.execPath, [VALIDATOR_PATH, runPath], {
      encoding: "utf8",
    });

    expect(result.stderr).toContain("same exact model");
  });

  it("rejects repository state that differs from the fixed case context", async () => {
    const suite = await loadSuite();
    const run = makeCompletedRun(suite);
    const cases = run.cases as Array<Record<string, unknown>>;
    const first = cases[0]!;
    const adapted = first.adapted as Record<string, unknown>;
    const repository = adapted.repository as Record<string, unknown>;
    repository.baseSha = "b".repeat(40);
    const runPath = await writeRun(run);

    const result = spawnSync(process.execPath, [VALIDATOR_PATH, runPath], {
      encoding: "utf8",
    });

    expect(result.stderr).toContain("fixed case repository context");
  });

  it("rejects a prompt that differs from the fixed task", async () => {
    const suite = await loadSuite();
    const run = makeCompletedRun(suite);
    const cases = run.cases as Array<Record<string, unknown>>;
    cases[0]!.prompt = "changed task";
    const runPath = await writeRun(run);

    const result = spawnSync(process.execPath, [VALIDATOR_PATH, runPath], {
      encoding: "utf8",
    });

    expect(result.stderr).toContain("fixed suite prompt");
  });

  it("rejects completed cases without pass/fail rationale", async () => {
    const suite = await loadSuite();
    const run = makeCompletedRun(suite);
    const cases = run.cases as Array<Record<string, unknown>>;
    delete cases[0]!.rationale;
    const runPath = await writeRun(run);

    const result = spawnSync(process.execPath, [VALIDATOR_PATH, runPath], {
      encoding: "utf8",
    });

    expect(result.stderr).toContain("rationale");
  });
});
