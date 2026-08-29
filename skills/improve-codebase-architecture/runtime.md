---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a Markdown candidate report, then grill through whichever one you pick.
disable-model-invocation: true
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities**: refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability. Analyze and report only: do not change production code, and wait at the upstream candidate-selection boundary before any selected-candidate design work.

This command is _informed_ by the project's domain model and built on a shared design vocabulary:

- Load `codebase-design` with `load_skill` for the architecture vocabulary (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**) and its principles (the deletion test, "the interface is the test surface", "one adapter = hypothetical seam, two = real"). Request this separate Dependency Skill at this exact upstream point before analysis; do not embed its runtime. Use these terms exactly in every suggestion, and don't drift into "component," "service," "API," or "boundary." If the dependency cannot be loaded when required, stop the affected architecture analysis rather than substituting invented methodology.
- The domain language in `CONTEXT.md` gives names to good seams; ADRs in `docs/adr/` record decisions this command should not re-litigate.

## Process

### 1. Explore

**Scope before you scan: YAGNI.** Deepening a module pays off by making future changes to it easier, so put extra weight on the parts of the codebase that have recently changed. Decide *where* to look before you look:

- If the user named a direction (a module, a subsystem, a pain point), take it, and skip the inference below.
- Otherwise, walk back a good stretch of the live commit history through connected GitHub capabilities to find the codebase's hot spots, the files and areas that keep coming up, and let those paths pull your attention first. If the changes are scattered with no clear hot spot, widen the net. If commit-history read capability is unavailable, report that missing evidence and widen the scan without inventing a hotspot.

Read the project's committed domain glossary (`CONTEXT.md`) and any ADRs in the area you're touching first through live connected GitHub capabilities. Read the relevant repository source through the same connected capability. If any repository evidence required for the affected analysis cannot be read, name the missing evidence and stop that affected analysis rather than inventing repository facts.

Then, if an independent child exploration can directly access GitHub and inspect the repository without parent-supplied evidence, use it to walk the codebase. Otherwise continue the same codebase walk in this conversation; do not pretend a child was independent. Don't follow rigid heuristics; explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow**, with an interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

### 2. Present candidates as a Markdown report

Return the candidate report directly in Markdown. Do not create temporary report files, browser infrastructure, or CDN-backed presentation. Use a diagram only where it materially clarifies the architecture; plain Markdown is the default.

For each candidate, include:

- **Files**: which files/modules are involved
- **Problem**: why the current architecture is causing friction
- **Solution**: plain English description of what would change
- **Benefits**: explained in terms of locality and leverage, and how tests would improve
- **Before / After diagram**: include only when it materially clarifies the shallowness and the deepening
- **Recommendation strength**: one of `Strong`, `Worth exploring`, `Speculative`

End the report with a **Top recommendation** section: which candidate you'd tackle first and why.

**Use CONTEXT.md vocabulary for the domain, and the `codebase-design` vocabulary for the architecture.** If `CONTEXT.md` defines "Order," talk about "the Order intake module," not "the FooBarHandler," and not "the Order service."

**ADR conflicts**: if a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting the ADR. Mark it clearly in the candidate. Don't list every theoretical refactor an ADR forbids.

Do NOT propose interfaces yet. After presenting the Markdown report, ask the user: "Which of these would you like to explore?" Then wait for the user's selection before loading later Dependency Skills or changing any production code.

### 3. Grilling loop

Once the user picks a candidate, load `grilling` with `load_skill` to walk the decision tree with them: constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive. Keep that Dependency Skill separate; if it cannot be loaded, stop the selected-candidate grilling phase rather than embedding or approximating it.

Side effects happen inline as decisions crystallize; load `domain-modeling` with `load_skill` to keep the domain model current as you go. Keep that Dependency Skill separate and request it only at this upstream post-selection point; if it cannot be loaded when required, report that missing capability and stop the affected domain-modeling action:

- **Naming a deepened module after a concept not in `CONTEXT.md`?** Add the term to `CONTEXT.md`. Create the file lazily if it doesn't exist.
- **Sharpening a fuzzy term during the conversation?** Update `CONTEXT.md` right there.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR, framed as: _"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"_ Only offer when the reason would actually be needed by a future explorer to avoid re-suggesting the same thing; skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **Want to explore alternative interfaces for the deepened module?** Load `codebase-design` with `load_skill` and use its Design It Twice pattern. Follow that Dependency Skill's capability rule for independent children instead of pretending parallel isolation.
