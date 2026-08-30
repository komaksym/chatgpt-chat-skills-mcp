import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT_URL = new URL("../", import.meta.url);
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
    const context = await readFile(new URL("CONTEXT.md", REPOSITORY_ROOT_URL), "utf8");
    const sectionStart = context.indexOf("## Canonical terms\n");
    const nextSectionStart = context.indexOf("\n## ", sectionStart + 1);
    const canonicalSection = context.slice(
      sectionStart,
      nextSectionStart === -1 ? context.length : nextSectionStart,
    );
    const headings = [...canonicalSection.matchAll(/^- \*\*(.+?)\*\* — /gm)].map(
      ([, term]) => term,
    );

    expect(sectionStart).toBeGreaterThanOrEqual(0);
    expect(headings).toHaveLength(CANONICAL_TERMS.length);
    expect(new Set(headings)).toEqual(new Set(CANONICAL_TERMS));
    expect(context).toContain("GitHub issue #1");
  });
});
