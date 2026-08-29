import { readFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

const CASES_URL = new URL("./cases.json", import.meta.url);
const JUDGMENTS = new Set(["pass", "fail", "not-observed"]);

function fail(message) {
  throw new Error(message);
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(label + " must be an object.");
  }
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(label + " must be a non-empty string.");
  }
  return value;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function definitions(suite) {
  if (suite.version !== 3 || suite.mode !== "manual-release-only" || !Array.isArray(suite.cases)) {
    fail("cases.json must be a version 3 manual-release-only suite.");
  }

  const seen = new Set();
  const counts = new Map();
  for (const definition of suite.cases) {
    text(definition.id, "case.id");
    text(definition.workflow, definition.id + ".workflow");
    text(definition.model, definition.id + ".model");
    text(definition.task, definition.id + ".task");
    text(definition.prompt, definition.id + ".prompt");
    if (seen.has(definition.id)) fail("duplicate case id " + definition.id);
    seen.add(definition.id);
    counts.set(definition.workflow, (counts.get(definition.workflow) ?? 0) + 1);
    if (!Array.isArray(definition.capabilities) || definition.capabilities.length === 0) {
      fail(definition.id + ".capabilities must be a non-empty array.");
    }
    if (!Array.isArray(definition.rubric) || definition.rubric.length === 0) {
      fail(definition.id + ".rubric must be a non-empty array.");
    }
  }
  for (const [workflow, count] of counts) {
    if (count > 2) fail(workflow + " has more than two representative cases.");
  }
  return new Map(suite.cases.map((item) => [item.id, item]));
}

function variant(value, definition, expectedSkill, label) {
  const item = object(value, label);
  if (item.skill !== expectedSkill) fail(label + ".skill does not match the fixed condition.");
  if (item.model !== definition.model) fail(label + ".model does not match the fixed case model.");
  if (!same(item.capabilities, definition.capabilities)) {
    fail(label + ".capabilities must exactly match the fixed case capabilities.");
  }

  const repository = object(item.repository, label + ".repository");
  text(repository.url, label + ".repository.url");
  if (
    repository.sourceRepository !== definition.repositoryContext.sourceRepository ||
    repository.baseSha !== definition.repositoryContext.baseSha
  ) {
    fail(label + ".repository must match the fixed source repository and base SHA.");
  }

  if (!Array.isArray(item.externalResults)) fail(label + ".externalResults must be an array.");
  const output = typeof item.output === "string" ? item.output.trim() : "";
  if (output === "" && item.externalResults.length === 0) {
    fail(label + " must record relevant output or an external result.");
  }

  if (!Array.isArray(item.rubric) || item.rubric.length !== definition.rubric.length) {
    fail(label + ".rubric must contain every fixed criterion.");
  }
  for (let index = 0; index < definition.rubric.length; index += 1) {
    const expected = definition.rubric[index];
    const actual = object(item.rubric[index], label + ".rubric[" + index + "]");
    if (actual.id !== expected.id) fail(label + ".rubric ids/order must match the fixed rubric.");
    if (!JUDGMENTS.has(actual.judgment)) fail(label + "." + actual.id + ".judgment is invalid.");
    text(actual.evidence, label + "." + actual.id + ".evidence");
  }

  if (typeof item.pass !== "boolean") fail(label + ".pass must be boolean.");
  text(item.rationale, label + ".rationale");
  if (item.pass && item.rubric.some((entry) => entry.judgment !== "pass")) {
    fail(label + " cannot pass unless every rubric item passes.");
  }
  return { repository, pass: item.pass };
}

async function main() {
  const runPath = process.argv[2];
  if (!runPath) fail("Usage: node evals/release/validate-run.mjs <completed-run.json>");

  const suite = JSON.parse(await readFile(CASES_URL, "utf8"));
  const byId = definitions(suite);
  const run = object(JSON.parse(await readFile(runPath, "utf8")), "run");

  if (run.mode !== "manual-release") fail("run.mode must be manual-release.");
  text(run.runId, "run.runId");
  if (!/^[a-f0-9]{40}$/.test(text(run.releaseSha, "run.releaseSha"))) {
    fail("run.releaseSha must be a 40-character commit SHA.");
  }
  if (!Array.isArray(run.cases) || run.cases.length !== byId.size) {
    fail("run.cases must contain exactly one result for every defined case.");
  }

  const seen = new Set();
  for (const resultValue of run.cases) {
    const result = object(resultValue, "case result");
    const caseId = text(result.caseId, "case result.caseId");
    if (seen.has(caseId)) fail("duplicate run case " + caseId);
    seen.add(caseId);

    const definition = byId.get(caseId);
    if (!definition) fail("unknown evaluation case " + caseId);
    if (
      result.task !== definition.task ||
      result.prompt !== definition.prompt ||
      (result.followUp ?? null) !== (definition.followUp ?? null)
    ) {
      fail(caseId + " task/prompt/followUp must match the fixed case exactly.");
    }

    const baseline = variant(result.baseline, definition, null, caseId + ".baseline");
    const adapted = variant(
      result.adapted,
      definition,
      definition.workflow,
      caseId + ".adapted",
    );
    if (definition.repositoryContext.writes && baseline.repository.url === adapted.repository.url) {
      fail(caseId + " writable variants must use separate disposable repositories.");
    }

    if (typeof result.pass !== "boolean") fail(caseId + ".pass must be boolean.");
    text(result.rationale, caseId + ".rationale");
    if (result.pass && !adapted.pass) {
      fail(caseId + " paired result cannot pass unless the adapted condition passes.");
    }
    text(result.comparison, caseId + ".comparison");
  }

  process.stdout.write(
    "Validated " + run.cases.length + " paired manual release evaluations.\n",
  );
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
  process.exitCode = 1;
});
