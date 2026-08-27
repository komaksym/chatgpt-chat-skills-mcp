Implement exactly one settled GitHub ticket or small specification. Read the
originating issue/specification, relevant repository rules, nearby code, existing
tests, domain context, and relevant ADRs before changing anything. Do not restart
requirements discovery or redesign settled behavior. If a contradiction blocks
implementation, surface only that concrete blocker; otherwise choose the narrowest
interpretation consistent with the settled work.

Protect the default branch. If the user or settled work names an existing feature
branch or pull request, use it. Otherwise identify the repository default branch,
create a feature branch from the intended base, and plan to finish through a pull
request. Never write directly to the default branch unless the user explicitly
authorizes direct default-branch mutation; the request to implement work is not that
authorization. Before changing production code, record the current commit as `review_base`.
Keep that pre-implementation commit unchanged as the comparison base for the later
committed-diff review.

## Testing phase

Do not preload testing guidance. When the first behavior slice is ready to test,
call load_skill with the exact canonical name `tdd`. Use the stable/public seam
already agreed in the ticket, specification, repository test conventions, or user
instruction. If no seam is actually settled and a test would otherwise couple to
internals, ask only for the minimal seam confirmation needed to proceed; do not
reopen product design.

Work one vertical tracer-bullet slice at a time: behavior first, observed RED,
minimum implementation, observed GREEN, then only behavior-preserving cleanup that
is useful to the current ticket. Prefer existing public interfaces and integration
patterns. Mock only true system boundaries. Never mock internal collaborators or
write tautological expectations.

Run the narrow relevant test file regularly when an execution capability is
available. Run typechecking regularly when available. A command, remote mutation,
commit, RED, GREEN, test pass, typecheck pass, build pass, or CI result may be
claimed only after its result is actually observed. If execution is unavailable,
tests may still be written or proposed, but record verification as not run rather
than inferring success.

## Commit and review phase

Once the implementation behavior is complete, run the available focused
verification needed to establish a stable implementation fixed point. Do not run
the full suite yet solely to create a pre-review claim.

Commit the verified implementation before review. After committing the verified
implementation, record that commit as `implementation_head`. Only after that commit
exists, call load_skill with the exact canonical name `code-review`. Review
`review_base...HEAD`, where `review_base` remains the pre-implementation comparison
base and `HEAD` initially equals `implementation_head`. Never redefine
`review_base` to the implementation commit, and never substitute an uncommitted
working tree. Apply only justified findings that serve repository standards or the
originating specification.

Commit justified review fixes as a later commit. If review finds no justified
changes, do not manufacture a second commit; record that outcome. Re-run the
available verification after review fixes. Run the full test suite once at the end
when a runner is available, alongside any final typecheck/build checks required by
the repository. Again, report only observed results.

Open or update the pull request. If a pull request already existed, keep using it;
otherwise open one from the feature branch to the intended base. Describe the
ticket scope, the implementation commit, any later review-fix commit, and the exact
observed verification. If a dependency, runner, write permission, review capability,
or CI result is unavailable, state that limitation plainly instead of fabricating
completion.
