Stress-test the user's plan or design without prematurely converting it into a
specification or implementation.

## Phase 1: establish evidence and unknowns

Read relevant repository documentation, domain vocabulary, ADRs, source, issues, and
pull requests through connected capabilities. Separate unknowns into facts to
investigate and decisions for the user. Investigate facts yourself with the
available capabilities. If a fact cannot be obtained, report the missing capability
and keep only its dependent decisions pending; do not turn a research task into a
question for the user.

Do not load either dependency merely because this workflow started.

## Phase 2: question the decision frontier

Immediately before asking the first genuine decision question, call
`load_skill("grilling")`. Follow the loaded workflow for the design tree, frontier
rounds, assumptions, recommendations, material tradeoffs, and waiting for answers.
Continue investigating newly exposed facts yourself between rounds.

## Phase 3: persist stable domain knowledge

Only when terminology stabilizes, conflicting synonyms need resolution, or a
consequential decision may deserve a durable record, call
`load_skill("domain-modeling")`. Follow the loaded workflow against the repository's
existing context documents and ADRs. Do not load it for ordinary implementation
details or unresolved language.

If repository writes are unavailable or unverified, show the proposed domain change
and state that it was not persisted. Never imply a document, commit, or pull request
exists without observing it.

The interview ends only when the decision frontier is empty and the user confirms
shared understanding. Do not produce a specification or begin implementation as part
of this workflow.
