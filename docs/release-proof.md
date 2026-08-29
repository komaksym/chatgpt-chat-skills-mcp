# Faithful ChatGPT Web release proof

Status: NOT EXERCISED

This record is not a success claim. The repository-side deterministic gates can be verified in CI, but the complete release requires a real ChatGPT Web Developer Mode session connected through the machine-local Secure MCP Tunnel. Change the status to `PASS` only after every required observation below is captured; otherwise record `FAIL` or leave it `NOT EXERCISED`.

## Implementation-time observation — 2026-08-29

A browser request to `http://127.0.0.1:2092/healthz` reached a browser error page, so the machine-local Skills service was not running in this session. The tunnel-backed ChatGPT Web smoke therefore remains `NOT EXERCISED`; no remote-read/write, missing-capability, or strict child-conversation result is claimed here.

## Local deterministic observation — 2026-08-29

The local checkout tested revision `1a7a341ff83af095ec00aac7b69631f2305c902b`. `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run corpus:check` completed successfully; the test suite reported 14 files and 98 tests, and the corpus check reported 11 skills (7 public and 4 hidden). After starting that built revision directly, `GET /healthz` returned HTTP 200 with exactly `{"status":"ok"}`.

The installed launcher was also invoked with the built service, but this machine-local session could not start the managed Skills target because its default state location was not writable and no dedicated `chatgpt-chat-skills-mcp` tunnel runtime was available. Native tunnel runtime creation and Chrome selection were unavailable in the session. These are environment blockers, not live acceptance results; the tunnel/Web, GitHub fixture, missing-capability, paired-evaluation, and strict child-conversation observations remain `NOT EXERCISED`.

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
- Deterministic corpus gates: PASS locally for `1a7a341ff83af095ec00aac7b69631f2305c902b`; no release CI URL is claimed here
- Manual release evaluations: `NOT EXERCISED`; no validated evidence record exists
