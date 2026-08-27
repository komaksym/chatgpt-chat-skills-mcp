Inspect the active remote GitHub repository for architecture deepening opportunities.
This workflow is analysis-first: it reports candidates, changes no production code, and waits for the user to choose one before focused design work.

## Phase 1: establish the architecture vocabulary and evidence

Immediately before evaluating architecture, call load_skill("codebase-design").
Use the loaded meanings of module, interface, depth, seam, adapter, leverage, and locality exactly and consistently in every candidate.
Do not substitute overloaded architecture terms for that vocabulary.

Read repository evidence through connected capabilities. Before proposing any candidate, read the canonical domain vocabulary from the root or relevant bounded-context context documents and read relevant ADRs for the area.
Every candidate must use that canonical domain vocabulary and account for relevant ADRs; do not re-litigate an ADR unless observed friction is strong enough to justify reopening it.

Scope the scan before widening it:
- If the user names a module, subsystem, or pain point, start there.
- Otherwise, when commit history is available, inspect a meaningful recent stretch and bias exploration toward actively changing files and areas.
- If commit history is unavailable or shows no useful hot spot, say so and widen the scan instead of inventing change evidence.

Explore the repository directly first. A child exploration is optional, never required.
Use a child only when that child has direct GitHub access and can independently inspect the repository; never paste parent-collected repository evidence as a substitute for direct child access.
If no suitable child capability exists, continue the scan in this conversation.

Look organically for architecture friction:
- understanding one domain concept requires bouncing among many small modules;
- a shallow module has an interface nearly as complex as its implementation;
- testability extractions reduced locality while leaving orchestration bugs elsewhere;
- coupled modules leak knowledge across a seam;
- multiple adapters reveal a real seam that is not represented cleanly;
- tests must reach past an interface because the module is the wrong shape.

Apply the deletion test to suspected shallow modules: deleting a useful module should move complexity back into multiple callers rather than make the complexity disappear.
Prefer opportunities that increase depth, leverage, and locality through a clearer interface and better-placed seam.

Do not change production code, tests, domain documents, branches, commits, or pull requests during candidate analysis.

## Phase 2: present candidates in Markdown

Return the candidate report directly in Markdown. Do not create a temporary HTML stack or assume an OS temp directory, browser opener, stylesheet CDN, or external report infrastructure.
Use a diagram only where it makes a relationship materially clearer; plain Markdown is the default.

For each candidate include:
- Files/modules: the repository locations involved, named with canonical domain vocabulary.
- Problem: the observed friction in terms of module, interface, depth, seam, adapter, leverage, or locality.
- Deepening direction: the architectural move in plain English without designing the final interface yet.
- Benefits: why locality, leverage, testability, or AI navigability improve.
- Evidence and ADRs: the repository evidence, active-change signal when available, and any relevant ADR constraint or conflict.
- Recommendation strength: Strong, Worth exploring, or Speculative.
- Optional diagram: only when useful.

End with one Top recommendation and explain why it has the best evidence-to-leverage ratio.
Do not propose final interfaces yet. Ask which candidate the user wants to explore, then wait for the user to select a candidate.

## Phase 3: deepen only the selected candidate

After the user selects a candidate, call load_skill("grilling") and use it to explore constraints, dependencies, the deepened module, the seam, the interface, adapters, and surviving tests.
Do not start production refactoring as part of this architecture-analysis workflow.

Only after selection, when canonical terminology or a consequential decision actually stabilizes, call load_skill("domain-modeling") and follow it for any justified domain-document or ADR work.
If terminology and durable decisions do not change, do not load domain-modeling merely to satisfy a checklist.

If the selected candidate needs alternative interface designs, continue using the already-loaded codebase-design discipline and compare alternatives on depth, locality, leverage, and seam placement before recommending one.
