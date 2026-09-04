import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const ADAPTER = new URL("../docs/adapt-codex-skill.md", import.meta.url);

function paragraphs(source: string): string[] {
  return source
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function hasParagraphWith(source: string, concepts: RegExp[]): boolean {
  return paragraphs(source).some((paragraph) =>
    concepts.every((concept) => concept.test(paragraph)),
  );
}

function describesMissingRequiredInputStop(source: string): boolean {
  return hasParagraphWith(source, [
    /\b(?:missing|unavailable|not available|cannot inspect)\b/i,
    /\b(?:required|source|upstream|supporting document|script|asset|dependency|input|material)\b/i,
    /\b(?:stop|stops|stopped|abort|fail|without emitting|partial spec)\b/i,
  ]);
}

function extractTemplate(source: string): string | undefined {
  return source.match(
    /<adaptation-spec-template>\n(?<body>[\s\S]*?)\n<\/adaptation-spec-template>/,
  )?.groups?.body;
}

describe("Codex-to-ChatGPT adaptation-spec skill", () => {
  it("preserves issue #44's durable adapter contract at the external Markdown seam", async () => {
    const source = await readFile(ADAPTER, "utf8");

    expect(source).toMatch(/name:\s*adapt-codex-skill/i);
    expect(
      hasParagraphWith(source, [
        /preserve upstream methodology/i,
        /concrete target-runtime constraint/i,
      ]),
    ).toBe(true);
    expect(
      hasParagraphWith(source, [/sole successful output/i, /Adaptation Spec/i]),
    ).toBe(true);
    expect(
      hasParagraphWith(source, [
        /(?:must not|do not|never)/i,
        /create (?:a )?GitHub issue/i,
        /commit repository changes/i,
        /final runtime bundle/i,
        /store skills in ChatGPT Library/i,
      ]),
    ).toBe(true);
    expect(source).toMatch(/complete Upstream Skill Bundle/i);
    expect(describesMissingRequiredInputStop(source)).toBe(true);
    expect(
      hasParagraphWith(source, [/mcps-launcher/i, /(?:inventory|authoritative)/i]),
    ).toBe(true);
    expect(
      hasParagraphWith(source, [
        /Target Runtime Profile/i,
        /Live Capability/i,
        /(?:separate|distinguish)/i,
      ]),
    ).toBe(true);
    expect(
      hasParagraphWith(source, [
        /deterministic/i,
        /sandbox/i,
        /(?:preserve|faithfully execute|run unchanged)/i,
      ]),
    ).toBe(true);
    expect(
      hasParagraphWith(source, [
        /Dependency Skill/i,
        /(?:separate|invocation timing|immediate|deferred)/i,
      ]),
    ).toBe(true);
    expect(
      hasParagraphWith(source, [
        /Source Provenance/i,
        /pinned-github/i,
        /absent/i,
      ]),
    ).toBe(true);
    expect(source).toMatch(/underlined, single-sentence note/i);
  });

  it("makes freshly inspected mcps-launcher bindings authoritative instead of hardcoded current bindings", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const environmentEvidence = source.match(
      /## Environment evidence\n(?<body>[\s\S]*?)\n## Target Runtime Profile versus Live Capability/,
    )?.groups?.body;

    expect(environmentEvidence).toBeDefined();
    expect(environmentEvidence).toContain(
      "freshly inspected `mcps-launcher` inventory is authoritative",
    );
    expect(environmentEvidence).toContain("non-authoritative examples");
    expect(environmentEvidence).not.toContain("In the current environment that is");
    expect(environmentEvidence).not.toContain("The current launcher invokes");
  });

  it("keeps missing-input stopped behavior outside the success-only Adaptation Spec template", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const template = extractTemplate(source);
    const requiredInput = source.match(
      /## Required input\n(?<body>[\s\S]*?)\n## Environment evidence/,
    )?.groups?.body;

    expect(requiredInput).toBeDefined();
    expect(describesMissingRequiredInputStop(requiredInput ?? "")).toBe(true);
    expect(template).toBeDefined();
    expect(describesMissingRequiredInputStop(template ?? "")).toBe(false);
  });
});
