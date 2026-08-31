# Domain Context

This context defines the vocabulary for preserving upstream engineering methodology
while adapting it to a constrained runtime. It exists so GitHub issue #1's canonical
terms are used consistently.

## Language

**Faithful Adapter**:
A repository that preserves an upstream skill's methodology and changes it only
when the target runtime requires an allowed adaptation.
_Avoid_: local rewrite, methodology fork

**Upstream Skill Bundle**:
The exact pinned `SKILL.md` plus every required Supporting Document for one skill.
_Avoid_: source file, prompt fragment

**Supporting Document**:
A document that an upstream skill needs in order to explain or carry out its
methodology.
_Avoid_: unrelated reference, dependency skill

**Dependency Skill**:
A separately named skill that another skill uses while remaining its own distinct
bundle.
_Avoid_: embedded skill, copied methodology

**Target Runtime Profile**:
The stable constraints for ChatGPT Web through this MCP: exactly `load_skill` and
`list_skills`, GitHub as the supported repository and issue tracker, and no assumed
local checkout, shell, filesystem, Git CLI, background process, connected tool, or
write access.
_Avoid_: user preference, live capability

**Live Capability**:
A capability verified in the current conversation rather than assumed from product
support.
_Avoid_: documented support, expected access

**Generated Runtime**:
The runtime text produced for one skill after its upstream methodology has been
adapted.
_Avoid_: upstream source, implementation notes

**Mechanical Projection**:
A repeatable transformation from an upstream skill bundle into its target runtime.
_Avoid_: rewrite, creative adaptation

**Self-Contained Runtime**:
A runtime that contains the supporting material needed to understand and use it.
_Avoid_: flattened dependencies, incomplete runtime

**Allowed Runtime Change**:
One of exactly four adaptation categories explicitly permitted by GitHub issue #1:

1. Inline required Supporting Documents verbatim and retarget their references.
2. Translate invocation syntax or tools while preserving timing, ordering,
   arguments, workflow meaning, and Dependency Skill boundaries.
3. Replace an unavailable operation with an Equivalent Mechanism that produces the
   same externally visible result.
4. Select an upstream-supported branch that matches the Target Runtime Profile and
   remove only setup or selection content for unsupported branches.

The list is closed.
_Avoid_: convenience change, preference-based cleanup

**Equivalent Mechanism**:
An alternate way to produce the same visible result as an unavailable operation.
_Avoid_: weaker substitute, textual imitation

**Unforced Drift**:
A difference from upstream that the target runtime does not require.
_Avoid_: harmless rewrite, local improvement

**Change Record**:
A concise explanation of why a runtime differs from upstream and how that difference
is bounded.
_Avoid_: implementation log, scratch note

**Runtime Envelope**:
Shared guidance that applies across loaded skills.
_Avoid_: skill-specific methodology, duplicated instructions

**Temporary Upstream Fix**:
A narrow correction for a reproduced upstream contradiction while its resolution is
not yet part of the upstream source.
_Avoid_: permanent fork, undocumented patch
