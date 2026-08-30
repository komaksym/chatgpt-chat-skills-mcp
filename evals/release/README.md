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

Judge behavior only from the pinned upstream workflow plus the Skill Adaptation
Contract in issue #1. Every rubric item in `cases.json` names its upstream commit,
upstream `SKILL.md` section, and contract user story. Do not derive judgments from a
locally rewritten `runtime.md`, provenance prose, or evaluator preference.

This matters especially for allowed adaptations: evaluate the upstream outcome, not
the local mechanism. For example, architecture reporting is judged by the upstream
candidate fields and selection boundary rather than by whether the adapted runtime
uses the upstream HTML delivery mechanism.

## Evaluation protocol

For the paired representative case:

1. Prepare two fresh contexts exactly as `repositoryContext.reset` says. If the case
   permits writes, the baseline and adapted variants must use separate disposable
   repositories so one cannot contaminate the other.
2. Run both variants against a Skills MCP built from the recorded releaseSha. Record
   the observed Skills MCP revision and how it was verified for each variant; a typed
   SHA with no observation is not enough.
3. Fix the case's `model`, `task`, repository base SHA and fixture, `capabilities`,
   `prompt`, optional `followUp`, and rubric. These inputs are identical between
   variants.
4. Baseline: use a fresh conversation and do **not** load the evaluated workflow.
5. Adapted: use another fresh conversation, load only the named public workflow, then
   send the exact same prompt.
6. Send the fixed `followUp` only at the scripted boundary. If a variant crosses that
   boundary early, record the relevant rubric failure before continuing.
7. A failed or unavailable Live Capability never passes because a weaker fallback
   produced something convenient. Judge against the upstream-required stop behavior
   or other upstream fallback declared by the source.
8. Record relevant model output and any durable external result needed to verify the
   behavior. Claims about GitHub mutations, tests, commits, PRs, labels, or
   relationships require observed external evidence. A rubric criterion marked
   `requiresExternalEvidence` cannot pass with an empty `externalResults` record.

For observation cases, set `baseline` to `null` and use the adapted record to capture
the direct observation. Do not invent a no-skill comparison for dependency timing or
an unavailable-capability stop check when direct observation is the meaningful test.

The suite contains one representative normal workflow and focused observations for
dependency timing and truthful stopping. Add another case only for a documented
regression or uncovered high-risk behavior.

## Recording

Copy `run-template.json` to a release record outside routine CI artifacts. For every
variant record:

- exact model, repository URL/base, and capabilities;
- the observed Skills MCP revision, matching the run's `releaseSha`, plus evidence
  showing how that running revision was identified;
- relevant output and external results;
- one judgment plus evidence for every fixed rubric item;
- overall pass/fail and a short rationale.

Then write the behavioral delta in `comparison` for paired cases. Observation cases
should state what was directly observed instead. A variant may legitimately fail; the
record must say why rather than turning `not-observed` into success.

Validate the completed record with:

```bash
node evals/release/validate-run.mjs path/to/completed-run.json
```

The validator checks comparability and record completeness only. It does not judge
model quality and does not execute model calls.
