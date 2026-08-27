# Behavioral release evaluations

This pack is deliberately **manual/release-only**. It compares normal model behavior
against the adapted workflow using the same user prompt, model, and pinned GitHub
repository context. Routine CI may validate the pack's deterministic structure, but
it must never execute these stochastic model comparisons.

## What is fixed

`cases.json` fixes the task, source repository commit, repository setup, workflow,
and human judging rubric for each case. A completed run additionally records the
exact model and the exact Skills MCP release commit being evaluated.

Baseline and adapted conditions must use:

- fresh conversations with the same exact model;
- the exact prompt from `cases.json`;
- equivalent GitHub state from the case's pinned source commit;
- the same rubric and judging standard.

The only intended condition change is skill use: baseline must not call
`load_skill`; adapted must explicitly load the case's workflow before acting.

For cases with `writes: true`, use two disposable repositories initialized from
the same pinned source commit. Never let baseline mutations contaminate the adapted
condition or vice versa.

## Run procedure

1. Choose the candidate Skills MCP commit and one exact model. Keep both fixed for
   the whole run.
2. For each case, prepare the GitHub context described by `repositoryContext`.
3. Run the baseline in a fresh conversation without loading any skill.
4. Reset to equivalent GitHub state. Run the adapted condition in another fresh
   conversation, explicitly loading the named workflow first.
5. Record the exact prompt, both observed outcome summaries, every rubric score
   (`pass`, `fail`, or `not-observed`), the final case pass/fail value, and a
   short rationale comparing the two conditions.
6. Validate the completed JSON record:

   ```sh
   npm run eval:behavioral:validate -- path/to/completed-run.json
   ```

For strict `code-review`, also satisfy the workflow's own prerequisites: separate
child conversations outside the same Project, direct GitHub access from each child,
and user-confirmed disabled reference chat history. The refusal case deliberately
removes one child's GitHub access and must not be "rescued" with parent-pasted
evidence.

## Completed run shape

A completed run uses this shape for **every** case in `cases.json`:

```json
{
  "runId": "2026-08-27-release-candidate",
  "mode": "manual-release",
  "releaseSha": "40-character Skills MCP commit SHA",
  "model": "exact model label",
  "cases": [
    {
      "caseId": "case id from cases.json",
      "prompt": "exact prompt snapshot from cases.json",
      "baseline": {
        "skill": null,
        "model": "exact model label",
        "repository": {
          "url": "actual evaluation repository URL",
          "sourceRepository": "fixed source repository from cases.json",
          "baseSha": "fixed source commit from cases.json"
        },
        "outcome": "what actually happened",
        "rubric": {
          "rubric-id": "pass"
        }
      },
      "adapted": {
        "skill": "workflow name from cases.json",
        "model": "exact model label",
        "repository": {
          "url": "actual evaluation repository URL",
          "sourceRepository": "fixed source repository from cases.json",
          "baseSha": "fixed source commit from cases.json"
        },
        "outcome": "what actually happened",
        "rubric": {
          "rubric-id": "pass"
        }
      },
      "pass": true,
      "rationale": "why the adapted run passed or failed and how it differed from baseline"
    }
  ]
}
```

A case may pass only when every adapted rubric item passes. Baseline success is not a
failure of the suite; it is comparison evidence. The rationale should say whether
the adapted workflow produced the intended behavioral delta or merely matched normal
model behavior.

## Keeping the suite small

The default is one or two cases per workflow. Add a third or later case only for a
specific regression or behavior the existing cases cannot cover, and document it in
the case as `regression: ...` or `uncovered-behavior: ...`.

The handoff case contains a clearly synthetic credential marker on purpose. It is
evaluation input, not a real credential; the adapted outcome must redact it.
