---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets. Through connected GitHub, resolve the intended base and any existing feature branch. If the work is not already on an explicitly selected non-default branch, create a feature branch from the intended base before production mutations. Do not mutate the repository default branch unless the upstream workflow and an explicit user instruction authorize that direct mutation; if the required branch or GitHub write capability is unavailable, stop the affected mutation and report it as incomplete. Before changing production code, record the current feature-branch head as `review_base` and keep that fixed point unchanged for the later `code-review` invocation.

Use `tdd` with `load_skill` where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end through an available live execution mechanism. Treat each run as complete only after observing its returned result; if no live execution mechanism is available, report that verification step as unobserved.

Once done, first commit the verified implementation to the current feature branch through connected GitHub and observe the returned commit result, then load `code-review` with `load_skill` and review the committed diff from the recorded `review_base` to that implementation commit. Continue with the upstream commit step for any work remaining after review.

Commit your work to the current feature branch through connected GitHub. Treat the commit as complete only after observing its returned result; if GitHub write capability is unavailable, stop the commit operation and report it as incomplete.
