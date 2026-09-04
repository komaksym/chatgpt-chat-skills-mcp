import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const ADAPTER = new URL("../docs/adapt-codex-skill.md", import.meta.url);

function paragraphs(source: string): string[] {
  return source
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function statements(source: string): string[] {
  return source
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?;])\s+/))
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function hasParagraphWith(source: string, concepts: RegExp[]): boolean {
  return paragraphs(source).some((paragraph) =>
    concepts.every((concept) => concept.test(paragraph)),
  );
}

function hasStatementWith(source: string, concepts: RegExp[]): boolean {
  return statements(source).some((statement) =>
    concepts.every((concept) => concept.test(statement)),
  );
}

function extractSection(source: string, heading: string): string | undefined {
  const marker = `## ${heading}\n`;
  const start = source.indexOf(marker);
  if (start === -1) {
    return undefined;
  }

  const bodyStart = start + marker.length;
  const nextHeading = source.indexOf("\n## ", bodyStart);
  return source.slice(bodyStart, nextHeading === -1 ? undefined : nextHeading).trim();
}

function describesMissingRequiredInputStop(source: string): boolean {
  return hasStatementWith(source, [
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
    expect(source).toMatch(
      /preserve upstream methodology[\s\S]{0,300}concrete target-runtime constraint/i,
    );
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
    expect(source).toMatch(
      /Keep these concepts separate:[\s\S]{0,400}Target Runtime Profile[\s\S]{0,400}Live Capability/i,
    );
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
    expect(source).toMatch(
      /Represent source origin truthfully\.[\s\S]{0,700}pinned-github[\s\S]{0,700}absent/i,
    );
    expect(source).toMatch(/underlined, single-sentence note/i);
  });

  it("makes inspected environment evidence authoritative for inventory and exact MCP semantics", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const environmentEvidence = extractSection(source, "Environment evidence");

    expect(environmentEvidence).toBeDefined();
    expect(
      hasStatementWith(environmentEvidence ?? "", [
        /mcps-launcher/i,
        /inventory/i,
        /authoritative/i,
      ]),
    ).toBe(true);
    expect(
      hasStatementWith(environmentEvidence ?? "", [
        /individual MCP repositories/i,
        /relevant/i,
        /exact/i,
        /capability/i,
        /limitation/i,
      ]),
    ).toBe(true);
    expect(environmentEvidence).toMatch(/non-authoritative examples/i);
    expect(environmentEvidence).not.toContain("In the current environment that is");
    expect(environmentEvidence).not.toContain("The current launcher invokes");
  });

  it("protects durable resource and state mappings semantically", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const mapping = extractSection(source, "Semantic classification");

    expect(mapping).toBeDefined();
    expect(
      hasStatementWith(mapping ?? "", [
        /ephemeral|intermediate/i,
        /working state/i,
        /ChatGPT sandbox/i,
      ]),
    ).toBe(true);
    expect(
      hasStatementWith(mapping ?? "", [
        /repository state|versioned skill state/i,
        /connected GitHub/i,
      ]),
    ).toBe(true);
    expect(
      hasStatementWith(mapping ?? "", [
        /Repository Assets/i,
        /GitHub-backed skill resources/i,
      ]),
    ).toBe(true);
    expect(
      hasStatementWith(mapping ?? "", [
        /user-facing generated deliverable/i,
        /ChatGPT Library/i,
        /appropriate/i,
      ]),
    ).toBe(true);
    expect(
      hasStatementWith(mapping ?? "", [/Storage/i, /consumption/i, /separate/i]),
    ).toBe(true);
  });

  it("protects browser-context and child-worker semantics", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const browserContexts = extractSection(source, "Browser contexts");

    expect(browserContexts).toBeDefined();
    expect(
      hasStatementWith(browserContexts ?? "", [
        /Chrome Browser MCP/i,
        /existing Chrome session|already-open tabs|real current Chrome context/i,
      ]),
    ).toBe(true);
    expect(
      hasStatementWith(browserContexts ?? "", [
        /Playwright MCP/i,
        /dedicated automated browser context|independent browser lifecycle/i,
      ]),
    ).toBe(true);
    expect(
      hasStatementWith(browserContexts ?? "", [
        /isolated|parallel/i,
        /verified child-worker mechanism/i,
        /upstream requirements/i,
      ]),
    ).toBe(true);
    expect(
      hasStatementWith(browserContexts ?? "", [
        /independent workers/i,
        /parallel dispatch/i,
        /verified live/i,
        /sequential prompts/i,
      ]),
    ).toBe(true);
  });

  it("protects interface-metadata intent without porting Codex-only UI mechanics", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const interfaceMetadata = extractSection(source, "Codex interface metadata");

    expect(interfaceMetadata).toBeDefined();
    expect(interfaceMetadata).toMatch(/agents\/openai\.yaml/i);
    expect(interfaceMetadata).toMatch(/meaningful author intent/i);
    expect(interfaceMetadata).toMatch(/explicit-only|discoverable/i);
    expect(interfaceMetadata).toMatch(
      /workflow constraints|description|argument intent/i,
    );
    expect(interfaceMetadata).toMatch(/Codex-only UI mechanics/i);
    expect(interfaceMetadata).toMatch(/semantic intent/i);
    expect(interfaceMetadata).toMatch(/concrete runtime constraint/i);
  });

  it("protects truthful stopping for unsupported host-macOS behavior", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const unsupportedHost = extractSection(source, "Unsupported host behavior");

    expect(unsupportedHost).toBeDefined();
    expect(
      hasStatementWith(unsupportedHost ?? "", [
        /host macOS/i,
        /Do not assume access/i,
      ]),
    ).toBe(true);
    expect(unsupportedHost).toMatch(/arbitrary files/i);
    expect(unsupportedHost).toMatch(/native apps/i);
    expect(unsupportedHost).toMatch(/local daemons|host processes/i);
    expect(
      hasStatementWith(unsupportedHost ?? "", [
        /no Equivalent Mechanism/i,
        /stopped behavior/i,
      ]),
    ).toBe(true);
  });

  it("keeps missing-input stopped behavior outside the success-only Adaptation Spec template", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const template = extractTemplate(source);
    const requiredInput = extractSection(source, "Required input");

    expect(requiredInput).toBeDefined();
    expect(describesMissingRequiredInputStop(requiredInput ?? "")).toBe(true);
    expect(template).toBeDefined();
    expect(describesMissingRequiredInputStop(template ?? "")).toBe(false);
  });
});
