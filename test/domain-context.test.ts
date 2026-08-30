import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url);
const CANONICAL_TERMS = [
  "Faithful Adapter",
  "Upstream Skill Bundle",
  "Supporting Document",
  "Dependency Skill",
  "Target Runtime Profile",
  "Live Capability",
  "Generated Runtime",
  "Mechanical Projection",
  "Self-Contained Runtime",
  "Allowed Runtime Change",
  "Equivalent Mechanism",
  "Unforced Drift",
  "Change Record",
  "Runtime Envelope",
  "Temporary Upstream Fix",
] as const;

describe("domain context glossary", () => {
  /** Verifies that issue #1's canonical adaptation vocabulary has one discoverable home. */
  it("defines the canonical issue 1 adaptation terms", async () => {
    const context = await readFile(new URL("CONTEXT.md", ROOT), "utf8");
    const headings = [...context.matchAll(/^- \*\*(.+?)\*\* — /gm)].map(([, term]) => term);

    expect(context).toContain("## Canonical terms");
    expect(headings).toEqual(CANONICAL_TERMS);
    expect(context).toContain("GitHub issue #1");
  });
});
