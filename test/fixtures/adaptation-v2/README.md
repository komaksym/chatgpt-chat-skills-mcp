# v2 adaptation acceptance fixtures

These fixtures are durable acceptance evidence for issue #45. They are deliberately outside the production `skills/` corpus.

`representative-v2` is one complete, intentionally absent-origin source bundle plus its issue-ready Adaptation Spec, Mechanical Projection metadata, committed Generated Runtime, Dependency Skill, deterministic helper, and Repository Asset. The focused test verifies behavior through generation and the production MCP service rather than snapshotting the adapter prompt.

`cases/missing-supporting` represents an incomplete Upstream Skill Bundle. Its required Supporting Document is intentionally absent, so the observed outcome is a stop record and there is intentionally no Adaptation Spec artifact.
