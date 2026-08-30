import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url);

/** Reads the root domain glossary. */
const readContext = () => readFile(new URL("CONTEXT.md", ROOT), "utf8");

describe("domain context glossary", () => {
  /** Verifies that issue #1's canonical adaptation vocabulary has one discoverable home. */
  it("defines the canonical issue 1 adaptation terms", async () => {
    const context = await readContext();
    for (const term of [
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
    ]) {
      expect(context).toContain(term);
    }
    expect(context).toContain("GitHub issue #1");
  });
});
