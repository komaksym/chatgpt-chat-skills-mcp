# Strict code-review smoke test

This procedure checks the strongest observable prerequisites for translating the
upstream parallel-sub-agent review into independent ChatGPT child conversations.
It is a capability smoke test, not a proof about hidden platform state.

## Prerequisites

- A live ChatGPT mechanism can create and address two distinct child conversations.
- Each child can use connected GitHub directly.
- The parent can keep each child's findings out of the sibling context until both
  reviews complete.

## Two-child synthetic canary

1. Create fresh child A for Standards and fresh child B for Spec.
2. Give child A only `STANDARDS-CANARY-7A` and child B only `SPEC-CANARY-7B`. Never include the sibling canary literal in the other child's prompt, even in a sentence saying that the child should not see it.
3. Give both children only repository coordinates, the same committed base/head refs,
   and their own axis methodology. Do not paste repository files, diffs, issue bodies,
   or findings from the parent.
4. Require each child to independently use connected GitHub, resolve the repository
   and exact head SHA, and report one repository path or issue identifier it fetched.
5. Require each child to return its own canary exactly and state only whether it saw any canary token other than its own. Do not name or quote the sibling canary in that child's prompt.
6. Inspect both reports only after both finish. Confirm that each independently
   observed GitHub and neither reports the sibling canary.

## Result recording

Record exactly one status:

- `PASS` — two distinct child conversations independently accessed GitHub, resolved
  the same pinned head, and neither showed the sibling canary.
- `FAIL` — the contexts were not distinct, a child lacked direct GitHub access,
  parent-pasted repository evidence was required, or a sibling canary leaked.
- `NOT EXERCISED` — the current environment does not expose the required
  child-conversation mechanism. Generic browser or tab automation is not equivalent.

## Implementation-time result — 2026-08-29

`NOT EXERCISED`

The implementation environment exposes no dedicated operation that can establish and
address two independent ChatGPT child conversations for this workflow. No strict
review pass or isolation claim was inferred.
