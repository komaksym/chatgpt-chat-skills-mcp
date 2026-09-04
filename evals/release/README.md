# Behavioral release evaluations

This suite is **manual/release only**. It answers one practical question: does the
product preserve the highest-risk upstream outcomes at the ChatGPT Web boundary?
It deliberately uses one paired no-skill/with-skill workflow plus focused
observation cases; it is not an exhaustive skill-by-skill benchmark. Where a
comparison is used, the same model receives the same task in the same repository
context with the same live capabilities.

The stochastic model runs are not routine CI. CI may validate the definitions and
record format, but it must not call a model. Exact Mechanical Projection generation,
source integrity, MCP protocol checks, and other deterministic behavior remain the
job of the normal test suite and issue #13.

## Source of truth

Judge behavior only from the pinned behavioral source plus the Skill Adaptation
Contract in issue #1. Workflow rubric items in `cases.json` name their pinned upstream
commit, upstream `SKILL.md` section, and contract user story. Adapter rubric items may
instead name the pinned `docs/adapt-codex-skill.md` section they exercise. Do not derive
judgments from a locally rewritten `runtime.md`, provenance prose, evaluator
preference, or the pre-authored representative `adaptation-spec.md` fixture.

This matters especially for allowed adaptations: evaluate the upstream outcome, not
the local mechanism. For example, architecture reporting is judged by the upstream
candidate fields and selection boundary rather than by whether the adapted runtime
uses the upstream HTML delivery mechanism.

## Evaluation protocol

1. Prepare fresh contexts exactly as `repositoryContext.reset` says. If a paired case
   permits writes, the baseline and adapted variants must use separate disposable
   repositories so one cannot contaminate the other.
2. Fix each case's `model`, `task`, repository base SHA and fixture, `capabilities`,
   `prompt`, optional `followUp`, and rubric exactly as defined in `cases.json`.
3. For an MCP workflow variant, run against a Skills MCP built from the recorded
   `releaseSha`. Record the observed Skills MCP revision and how it was verified; a
   typed SHA with no observation is not enough.
4. For an external `adapt-codex-skill` observation, do **not** pretend the adapter is an
   MCP-loaded skill. Load the exact `docs/adapt-codex-skill.md` commit/path named by the
   rubric source and record evidence that this exact document was the behavioral
   source. The adapter pin is independent of `run.releaseSha`.
5. Paired baseline: use a fresh conversation and do **not** load the evaluated MCP
   workflow. Paired adapted: use another fresh conversation and load only the named
   public workflow. Observation cases use one fresh direct-observation context.
6. Send the fixed `followUp` only at the scripted boundary. If a variant crosses that
   boundary early, record the relevant rubric failure before continuing.
7. A failed or unavailable Live Capability never passes because a weaker fallback
   produced something convenient. Judge against the source-required stop behavior or
   other fallback declared by the pinned behavioral source.
8. Record relevant model output and any durable external result needed to verify the
   behavior. Claims about GitHub mutations, tests, commits, PRs, labels, or
   relationships require observed external evidence. A rubric criterion marked
   `requiresExternalEvidence` cannot pass with an empty `externalResults` record.

For observation cases, set `baseline` to `null` and use the adapted record to capture
the direct observation. Do not invent a no-skill comparison for dependency timing,
unavailable-capability stopping, or adapter behavior when direct observation is the
meaningful test.

The suite contains one representative normal workflow plus focused observations for
dependency timing, truthful stopping, adapter missing-required-material behavior, and
a successful adapter run over a complete representative v2 bundle. The successful
adapter observation is semantic: judge preservation, runtime mappings, helper and
Dependency Skill boundaries, truthful provenance, and completion of the Adaptation
Spec. Do not snapshot exact wording.

## Recording

Copy `run-template.json` to a release record outside routine CI artifacts. For every
variant record, capture the exact model, repository URL/base, capabilities, relevant
output and external results, every rubric judgment with evidence, and overall
pass/fail with a short rationale.

Evidence-source fields are mutually exclusive:

- MCP workflow variants use `skillsMcp` with repository
  `komaksym/chatgpt-chat-skills-mcp`, the observed `releaseSha`, and evidence showing
  how the running revision was identified; set `adapter` to `null`.
- External-adapter observations set `skillsMcp` to `null` and use `adapter` with
  repository `komaksym/skills-mcp`, the pinned adapter commit and path, and evidence
  showing that exact document was loaded for the run.

An adapter evidence record has this shape:

```json
{
  "skillsMcp": null,
  "adapter": {
    "repository": "komaksym/skills-mcp",
    "commit": "<pinned adapter commit>",
    "path": "docs/adapt-codex-skill.md",
    "evidence": "<how this exact document was observed as the behavioral source>"
  }
}
```

Then write the behavioral delta in `comparison` for paired cases. Observation cases
should state what was directly observed instead. A variant may legitimately fail; the
record must say why rather than turning `not-observed` into success.

Validate the completed record with:

```bash
node evals/release/validate-run.mjs path/to/completed-run.json
```

The validator checks comparability and record completeness only. It does not judge
model quality and does not execute model calls.
