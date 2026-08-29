# Behavioral release evaluations

This suite is **manual/release only**. It answers one practical question: when the
same model receives the same task in the same repository context with the same live
capabilities, does loading one adapted skill make the result follow the important
outcomes of the pinned upstream workflow?

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

## Paired protocol

For each case:

1. Prepare two fresh contexts exactly as `repositoryContext.reset` says. If the case
   permits writes, the baseline and adapted variants must use separate disposable
   repositories so one cannot contaminate the other.
2. Fix the case's `model`, `task`, repository base SHA and fixture, `capabilities`,
   `prompt`, optional `followUp`, and rubric. These inputs are identical between
   variants.
3. Baseline: use a fresh conversation and do **not** load the evaluated workflow.
4. Adapted: use another fresh conversation, load only the named public workflow, then
   send the exact same prompt.
5. Send the fixed `followUp` only at the scripted boundary. If a variant crosses that
   boundary early, record the relevant rubric failure before continuing.
6. A failed or unavailable Live Capability never passes because a weaker fallback
   produced something convenient. Judge against the upstream-required stop behavior
   or other upstream fallback declared by the source.
7. Record relevant model output and any durable external result needed to verify the
   behavior. Claims about GitHub mutations, tests, commits, PRs, labels, or
   relationships require observed external evidence.

Normally there is one representative case per public workflow. A second case is
allowed for a documented regression or uncovered behavior; anything beyond two is a
suite-definition error.

## Recording

Copy `run-template.json` to a release record outside routine CI artifacts. For every
variant record:

- exact model, repository URL/base, and capabilities;
- relevant output and external results;
- one judgment plus evidence for every fixed rubric item;
- overall pass/fail and a short rationale.

Then write the behavioral delta in `comparison`. A variant may legitimately fail; the
record must say why rather than turning `not-observed` into success.

Validate the completed record with:

```bash
node evals/release/validate-run.mjs path/to/completed-run.json
```

The validator checks comparability and record completeness only. It does not judge
model quality and does not execute model calls.
