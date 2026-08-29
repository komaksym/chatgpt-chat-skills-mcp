# Faithful ChatGPT Web release proof

Status: NOT EXERCISED

This record is not a success claim. The repository-side deterministic gates can be verified in CI, but the complete release requires a real ChatGPT Web Developer Mode session connected through the machine-local Secure MCP Tunnel. Change the status to `PASS` only after every required observation below is captured; otherwise record `FAIL` or leave it `NOT EXERCISED`.

## Preconditions

1. Build the exact release revision and start the loopback service.
2. Observe HTTP 200 plus `{"status":"ok"}` from `/healthz`.
3. Start the dedicated Secure MCP Tunnel profile and observe it healthy.
4. Open a fresh ChatGPT Web Developer Mode conversation backed by that tunnel.

Captured evidence must contain no secrets or machine-local configuration values.

## MCP discovery and catalog evidence

Record the observed tool discovery result. It must contain exactly `load_skill` and `list_skills`.

Invoke `list_skills` and verify it returns exactly seven public skills: `code-review`, `grill-with-docs`, `handoff`, `implement`, `improve-codebase-architecture`, `to-spec`, and `to-tickets`.

Verify the hidden Dependency Skills `codebase-design`, `domain-modeling`, `grilling`, and `tdd` are absent from listing but can be loaded by exact canonical name when an upstream workflow requests them.

For representative public loads, capture enough response evidence to show the loader returned one Runtime Envelope plus the requested committed Generated Runtime only. Confirm separate Dependency Skills are requested at the upstream-defined timing rather than embedded in the parent response.

## Remote GitHub outcomes

Run a representative workflow against a disposable GitHub fixture and capture real remote reads and writes. At least one required external result must be a native GitHub relationship or label outcome; Markdown text describing a relationship does not count. Record durable GitHub result identifiers rather than machine-local diagnostic material.

Then run a case where one required Live Capability is unavailable. Capture the workflow stopping the affected operation or reporting truthful partial completion. A convenient weaker substitute is a failure of this proof.

## Strict code-review gate

Use `docs/code-review-strict-smoke.md`. Mark strict `code-review` as `PASS` only when two genuinely independent child conversations are separately addressable, each has direct GitHub access, both resolve the same committed head, neither receives parent-pasted repository evidence, and the documented isolation canary passes. Sequential reviews, two tabs showing the same conversation, or a child without direct GitHub access are not strict mode.

## Deterministic and behavioral gates

Before declaring the project complete, record successful execution of:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run corpus:check
```

Also complete the small paired manual release evaluations exactly as documented in `evals/release/README.md`, validate the completed record with `node evals/release/validate-run.mjs`, and keep the observed Skills MCP revision tied to the release revision under test.

## Maintenance scope

Issue #12 is post-release maintenance work. Link it from the release handoff, but do not make its upstream-update automation a blocker for this release proof.

## Evidence hygiene

Committed evidence must contain no secrets, tunnel credentials, machine-local configuration values, obsolete local-harness instructions, or unsupported tracker guidance.

## Result

- Overall status: `NOT EXERCISED`
- ChatGPT Web / tunnel smoke: `NOT EXERCISED`
- Strict code-review smoke: use the status recorded in `docs/code-review-strict-smoke.md`
- Deterministic corpus gates: record the release CI run URL after execution
- Manual release evaluations: record the validated evidence location after execution
