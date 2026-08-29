# ADR: Temporary Upstream Fix for implement review ordering

## Status

Temporary and pin-guarded.

## Context

The pinned `implement` entrypoint orders its final operations as review first and
commit second. The pinned `code-review` dependency, however, reviews the committed
difference between a fixed point and `HEAD`; its remote Mechanical Projection also
requires a committed head before strict review can start.

Those two pinned instructions cannot both be executed literally for newly implemented
work. Reviewing before the first implementation commit would either produce no
committed implementation diff or require substituting uncommitted parent-context
evidence, which the faithful code-review workflow rejects.

## Decision

Apply one Temporary Upstream Fix to the single upstream review sentence in
`skills/implement/upstream.md`: create the verified implementation commit first,
then load the separate `code-review` Dependency Skill and review from the recorded
pre-implementation `review_base` to that committed implementation head.

The ordinary final upstream commit sentence remains outside the fix. Its ordinary
Change Record only translates the commit operation to connected GitHub. The TUF
itself carries the contradiction-specific consequence that this later commit step
applies to any work remaining after review; no ordinary Change Record adds review-fix
policy, extra verification, or pull-request publication.

## Expiry guards

The fix is authorized only while both relevant upstream pins remain
`6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`:

- `implement` — `skills/engineering/implement/SKILL.md`
- `code-review` — `skills/engineering/code-review/SKILL.md`

Generation must fail if either pin changes. A new pin requires re-reading both
upstream workflows and either removing the fix or explicitly re-authorizing a new
minimal fix.

## Verification

`test/implement-runtime.test.ts` protects the fixed-point ordering, separate
Dependency Skill timing, observed verification semantics, default-branch safety,
and expiry on changes to either guarded pin.
