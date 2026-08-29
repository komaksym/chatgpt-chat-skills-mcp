---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets. Treat that scope as settled unless a concrete contradiction blocks implementation. Through connected GitHub, resolve the intended base and any existing feature branch or pull request. If the work is not already on an explicitly selected non-default branch, create a feature branch from the intended base before production mutations. Do not mutate the repository default branch unless the upstream workflow and an explicit user instruction authorize that direct mutation; if the required branch or GitHub write capability is unavailable, stop the mutation and report what remains incomplete. Before changing production code, record the current feature-branch head as `review_base` and keep that fixed point unchanged for the later code review.

Use `tdd` with `load_skill` where possible, at pre-agreed seams. Request that Dependency Skill at this exact testing point; do not embed its runtime into `implement`. If `tdd` cannot be loaded or the required execution capability is unavailable, stop the affected testing operation and report it as incomplete rather than substituting an unobserved result.

Run typechecking regularly, single test files regularly, and the full test suite once at the end through whatever live execution mechanism is actually connected. Claim a typecheck, test, build, or CI result only after observing its returned result. If required execution or result inspection is unavailable, stop that verification step and report it as not observed.

Once done, first commit the verified implementation to the current feature branch, then load `code-review` with `load_skill` and review the committed diff from the recorded `review_base` to that implementation commit.

After review, commit only justified review fixes to the current feature branch; if no justified fix exists, do not manufacture another commit. Complete the required final observed verification, including the upstream full-suite-at-the-end step when a runner is live, then open or update the pull request from the feature branch to the intended base through connected GitHub. Claim commits, pushes, checks, reviews, pull requests, and their statuses only after observing the corresponding results. If a required write, review, execution, or verification capability is unavailable, stop that affected operation and report exactly what remains incomplete.
