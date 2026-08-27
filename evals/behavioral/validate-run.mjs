import { readFile } from "node:fs/promises";

const CASES_URL = new URL("./cases.json", import.meta.url);
const SCORE_VALUES = new Set(["pass", "fail", "not-observed"]);

function fail(message) {
  throw new Error(message);
}

function asObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  return value;
}

function asNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  return value;
}

function validateRepository(repository, definition, label) {
  const value = asObject(repository, label);
  asNonEmptyString(value.url, `${label}.url`);
  if (value.sourceRepository !== definition.repositoryContext.sourceRepository) {
    fail(`${label}.sourceRepository must match the fixed case repository context.`);
  }
  if (value.baseSha !== definition.repositoryContext.baseSha) {
    fail(`${label}.baseSha must match the fixed case repository context.`);
  }
  return value;
}

function validateRubric(value, definition, label) {
  const rubric = asObject(value, label);
  const expected = new Set(definition.rubric.map((criterion) => criterion.id));

  for (const id of expected) {
    if (!Object.hasOwn(rubric, id)) {
      fail(`${label} is missing rubric item ${id}.`);
    }
    if (!SCORE_VALUES.has(rubric[id])) {
      fail(`${label}.${id} must be pass, fail, or not-observed.`);
    }
  }

  for (const id of Object.keys(rubric)) {
    if (!expected.has(id)) {
      fail(`${label} contains unknown rubric item ${id}.`);
    }
  }
  return rubric;
}

function validateSuite(suite) {
  if (suite.mode !== "manual-release-only" || !Array.isArray(suite.cases)) {
    fail("cases.json must describe a manual-release-only suite.");
  }

  const ids = new Set();
  const byWorkflow = new Map();
  for (const definition of suite.cases) {
    if (ids.has(definition.id)) fail(`Duplicate case id: ${definition.id}.`);
    ids.add(definition.id);
    const items = byWorkflow.get(definition.workflow) ?? [];
    items.push(definition);
    byWorkflow.set(definition.workflow, items);
  }

  for (const [workflow, definitions] of byWorkflow) {
    for (const definition of definitions.slice(2)) {
      if (
        typeof definition.justification !== "string" ||
        !/^(regression|uncovered-behavior):/.test(definition.justification)
      ) {
        fail(
          `Extra ${workflow} cases beyond the default two require a regression: or uncovered-behavior: justification.`,
        );
      }
    }
  }

  return new Map(suite.cases.map((definition) => [definition.id, definition]));
}

async function main() {
  const runPath = process.argv[2];
  if (!runPath) {
    fail("Usage: node evals/behavioral/validate-run.mjs <completed-run.json>");
  }

  const suite = JSON.parse(await readFile(CASES_URL, "utf8"));
  const definitions = validateSuite(suite);
  const run = asObject(
    JSON.parse(await readFile(runPath, "utf8")),
    "run",
  );

  if (run.mode !== "manual-release") {
    fail("run.mode must be manual-release.");
  }
  asNonEmptyString(run.runId, "run.runId");
  const model = asNonEmptyString(run.model, "run.model");
  const releaseSha = asNonEmptyString(run.releaseSha, "run.releaseSha");
  if (!/^[a-f0-9]{40}$/.test(releaseSha)) {
    fail("run.releaseSha must be a 40-character commit SHA.");
  }
  if (!Array.isArray(run.cases)) {
    fail("run.cases must be an array.");
  }
  if (run.cases.length !== definitions.size) {
    fail("run.cases must contain exactly one result for every defined evaluation case.");
  }

  const seen = new Set();
  for (const resultValue of run.cases) {
    const result = asObject(resultValue, "case result");
    const caseId = asNonEmptyString(result.caseId, "case result.caseId");
    if (seen.has(caseId)) fail(`Duplicate run case: ${caseId}.`);
    seen.add(caseId);

    const definition = definitions.get(caseId);
    if (!definition) fail(`Unknown evaluation case: ${caseId}.`);
    if (result.prompt !== definition.prompt) {
      fail(`Case ${caseId} prompt must match the fixed suite prompt exactly.`);
    }

    const baseline = asObject(result.baseline, `${caseId}.baseline`);
    const adapted = asObject(result.adapted, `${caseId}.adapted`);
    if (baseline.skill !== null) {
      fail(`Case ${caseId} baseline must run without a skill.`);
    }
    if (adapted.skill !== definition.workflow) {
      fail(`Case ${caseId} adapted run must load ${definition.workflow}.`);
    }
    if (baseline.model !== model || adapted.model !== model) {
      fail(`Case ${caseId} baseline and adapted runs must use the same exact model as run.model.`);
    }

    const baselineRepository = validateRepository(
      baseline.repository,
      definition,
      `${caseId}.baseline.repository`,
    );
    const adaptedRepository = validateRepository(
      adapted.repository,
      definition,
      `${caseId}.adapted.repository`,
    );
    if (
      definition.repositoryContext.writes &&
      baselineRepository.url === adaptedRepository.url
    ) {
      fail(
        `Case ${caseId} permits writes, so baseline and adapted runs must use separate disposable repositories.`,
      );
    }

    asNonEmptyString(baseline.outcome, `${caseId}.baseline.outcome`);
    asNonEmptyString(adapted.outcome, `${caseId}.adapted.outcome`);
    validateRubric(
      baseline.rubric,
      definition,
      `${caseId}.baseline.rubric`,
    );
    const adaptedRubric = validateRubric(
      adapted.rubric,
      definition,
      `${caseId}.adapted.rubric`,
    );

    if (typeof result.pass !== "boolean") {
      fail(`Case ${caseId}.pass must be boolean.`);
    }
    asNonEmptyString(result.rationale, `${caseId}.rationale`);
    if (
      result.pass &&
      definition.rubric.some((criterion) => adaptedRubric[criterion.id] !== "pass")
    ) {
      fail(
        `Case ${caseId} cannot pass unless every adapted rubric item passes.`,
      );
    }
  }

  process.stdout.write(
    `Validated ${run.cases.length} paired manual behavioral evaluations for ${model}.\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
