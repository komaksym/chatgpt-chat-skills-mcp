# Strict code-review smoke test

This procedure checks the strongest observable prerequisites for translating the
upstream parallel-sub-agent review into independent ChatGPT child conversations.
It is a capability smoke test, not a proof about hidden platform state.

In this ChatGPT environment, `@chrome-mcp` is the supported child-review
mechanism. It implements isolation by creating and separately addressing distinct
ChatGPT conversations in separate browser tabs. A browser tab is not sufficient by
itself: each child tab must point at a different ChatGPT conversation URL/ID and
remain independently addressable for the whole review.

## Prerequisites

- `@chrome-mcp` can create or navigate to two separate browser tabs containing two
  distinct ChatGPT conversations and can address each tab independently.
- Each child conversation can use connected GitHub directly.
- The parent can keep each child's findings out of the sibling conversation until both
  reviews complete.
- When both axes run, the parent can dispatch the two child prompts without serially
  feeding one child's result into the other.

## Two-child synthetic canary

1. Create a fresh ChatGPT conversation in one browser tab for child A (Standards) and
   a different fresh ChatGPT conversation in another browser tab for child B (Spec).
   Confirm the tabs have distinct ChatGPT conversation URLs/IDs.
2. Generate two fresh random per-run private markers outside the repository. Give
   child A only its own marker and child B only its own marker. Never record the
   markers in the repository, an issue, a PR, a prompt to the other child, or any
   other resource the children can fetch.
3. Give both children only repository coordinates, the same committed base/head refs,
   and their own axis methodology. Do not paste repository files, diffs, issue bodies,
   or findings from the parent.
4. Require each child to independently use connected GitHub, resolve the repository
   and exact head SHA, and report one repository path or issue identifier it fetched.
5. Require each child to return its private marker exactly and state only whether it
   saw any foreign marker. Do not name or quote a foreign marker in either prompt or
   report.
6. Inspect both reports only after both finish. Confirm that each independently
   observed GitHub and neither reports a foreign marker.

## Result recording

Record exactly one status:

- `PASS` — two separately addressable `@chrome-mcp` tabs contained distinct
  ChatGPT conversations, both independently accessed GitHub and resolved the same
  pinned head, and neither showed a foreign marker.
- `FAIL` — the tabs pointed at the same ChatGPT conversation, the contexts were not
  independently addressable, a child lacked direct GitHub access, parent-pasted
  repository evidence was required, or a foreign marker leaked.
- `NOT EXERCISED` — the current environment cannot create/address two distinct
  ChatGPT conversations through `@chrome-mcp`, or the synthetic canary has not
  been run.

Separate `@chrome-mcp` tabs are therefore a valid child-review mechanism only when
they contain distinct ChatGPT conversations and satisfy the canary. Arbitrary browser
tabs, two tabs showing the same conversation, or two sequential prompts in one
conversation are not equivalent.

## Current result — 2026-08-30

`NOT EXERCISED`

The synthetic canary was previously observed against committed head
`bf5de9371e8255d7ed27c3391b9478ee0b0c3acd`, but it was not rerun against the
current release head. The older observation cannot establish the result for a
different head, so rerun the canary against the exact final committed head before
recording `PASS`.
