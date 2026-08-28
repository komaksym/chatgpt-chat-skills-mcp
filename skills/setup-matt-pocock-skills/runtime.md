Use connected GitHub capabilities to establish only the domain documentation that
Matt Pocock's skills expect, reshaped for ChatGPT Web rather than a local checkout.

## 1. Resolve the repository and capabilities

Use a repository explicitly named or linked by the user. Otherwise use connected
repository context only when it identifies one repository unambiguously. If it
contains more than one plausible repository, ask which repository to use rather than
guessing from recency, search ranking, or incidental tool results.

Verify read access by observing repository metadata and a repository file listing.
Verify write access only from explicit repository permission data plus an available
connected write capability; do not mutate the repository merely to probe access.
Treat write access as unavailable unless both are observed. Separately observe
whether branch and pull-request creation capabilities are available.

## 2. Inspect existing domain evidence

Read existing `CONTEXT.md`, `CONTEXT-MAP.md`, relevant `docs/adr/` records,
context-scoped domain documents, the repository overview, and representative source,
test, and documentation areas that expose domain language. Inspect existing
documentation before proposing changes.

Treat existing glossary vocabulary as canonical for setup. Preserve an existing
context topology unless the user explicitly asks to reconsider it. Reruns should be
idempotent: add only justified missing information and avoid duplicate terms,
formatting churn, or unrelated rewrites.

Repository evidence may establish domain vocabulary, but implementation identifiers
alone do not. Record a missing term only when the repository already uses it as
established domain language without an unresolved conflict. When terms compete or a
term is overloaded, report the ambiguity and leave that glossary entry unchanged or
absent; resolving new canonical language belongs to domain-modeling.

## 3. Preserve Matt's domain-document semantics

Default to **single-context**: one root `CONTEXT.md`, with system-wide ADRs under
`docs/adr/`. A monorepo layout alone is not evidence of multiple contexts. Propose a
root `CONTEXT-MAP.md` and context-scoped `CONTEXT.md` files only when repository
structure and domain language show distinct bounded contexts. Explain the evidence
and wait for confirmation before introducing multi-context structure.

A `CONTEXT.md` is a domain glossary, not a specification, implementation guide,
scratch pad, or architecture dump. Follow the upstream glossary shape:

- a context name and one- or two-sentence description;
- a `## Language` section;
- domain-specific terms only;
- one- or two-sentence definitions of what each term is, not what it does;
- `_Avoid_` synonyms when the repository already establishes the canonical term and
  those alternatives as non-canonical language;
- natural subheadings only when useful.

Do not create empty glossaries, placeholder context documents, empty directories, or
ADRs merely because setup ran. If no domain term is established strongly enough to
record, a successful setup may make no domain-document change.

Read and preserve existing ADRs. Do not create a new ADR from an implementation
choice inferred during repository inspection; ADRs record an actual consequential,
non-obvious, difficult-to-reverse decision and its real tradeoff and rationale.

## 4. Propose before mutating

Before the first repository mutation, show the complete proposed files and contents,
identify the selected layout, summarize the evidence, and state how persistence would
occur. Wait for user approval. Preserve unrelated content and existing canonical
vocabulary.

When write access is verified and connected capabilities support it, prefer one
reviewable branch, one coherent approved change-set, and a pull request rather than
writing directly to the target branch.

If branch or pull-request creation is unavailable but direct file writes are
available, disclose the exact target branch and ask for explicit direct-write approval
before mutating it. General approval of the proposal is not direct-write approval.

When write access is unavailable or unverified, return the complete proposed content
in chat, state explicitly that it was **not persisted**, and report which permission
or capability blocked persistence. Never imply that a file, commit, branch, or pull
request exists unless its result was observed.

If a remote mutation succeeds and a later dependent mutation fails, stop dependent
writes, inspect the resulting repository state, and report the exact partial state:
what persisted, what did not, and what action remains. Do not claim setup completed
or claim a rollback unless the rollback result was observed.

Finish with the repository identified, access actually observed, layout selected,
evidence used, proposal approved or not, exact persisted changes if any, and remaining
user decisions.
