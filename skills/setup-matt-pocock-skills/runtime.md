Use connected GitHub capabilities to establish only the domain-document structure
that the active repository's evidence justifies.

## 1. Establish capabilities

Identify the active GitHub repository from connected repository context. Verify read
access by observing repository metadata and a repository file listing. Verify write
access only from explicit repository permission data plus an available connected
write capability; do not mutate the repository merely to probe access. Treat write
access as unavailable unless both are observed.

## 2. Inspect the repository directly

Read existing `CONTEXT.md`, `CONTEXT-MAP.md`, relevant `docs/adr/` records,
context-scoped domain documents, the repository overview, and representative source
areas that expose domain language. Inspect existing documentation before proposing
new structure. Only inspect and change domain documentation relevant to this setup;
do not modify agent-instruction or tracker-configuration files.

## 3. Choose the smallest justified layout

Default to **single-context**: one root `CONTEXT.md` and system-wide records under
`docs/adr/`. A monorepo layout alone is not evidence of multiple contexts. Propose
multi-context documentation only when both repository structure and domain language
show distinct bounded contexts. Explain the evidence and wait for confirmation
before introducing a root `CONTEXT-MAP.md` or context-scoped documents.

Do not create empty glossaries, placeholder context documents, empty directories, or
ADRs merely because setup ran. Populate a context document only with terms and
boundaries evidenced by the repository. Reserve an ADR for a consequential,
non-obvious, difficult-to-reverse decision with a genuine tradeoff.

## 4. Persist truthfully

When write access is verified, create or update only the minimal justified domain
documents through connected GitHub capabilities and report the exact files changed.
Preserve unrelated content and existing canonical vocabulary.

When write access is unavailable or unverified, return the complete proposed content
in chat, state explicitly that it was **not persisted**, and never imply that a file,
commit, or pull request exists. Report which missing permission or capability blocked
persistence.

Finish with the repository identified, access actually observed, layout selected,
evidence used, persisted changes if any, and remaining user decisions.
