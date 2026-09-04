import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const ADAPTER = new URL("../docs/adapt-codex-skill.md", import.meta.url);

function expectAll(source: string, patterns: RegExp[]): void {
  for (const pattern of patterns) {
    expect(source).toMatch(pattern);
  }
}

function templateOf(source: string): string {
  return (
    source.match(
      /<adaptation-spec-template>\n(?<body>[\s\S]*?)\n<\/adaptation-spec-template>/,
    )?.groups?.body ?? ""
  );
}

describe("Codex-to-ChatGPT adaptation-spec skill", () => {
  it("keeps issue #44's durable adapter contract", async () => {
    const source = await readFile(ADAPTER, "utf8");

    expectAll(source, [
      /name:\s*adapt-codex-skill/i,
      /complete \*\*Upstream Skill Bundle\*\*/i,
      /stop without emitting an Adaptation Spec/i,
      /preserve upstream[\s\S]{0,250}concrete target-runtime constraint/i,
      /closed Allowed Runtime Change set/i,
      /mcps-launcher[\s\S]{0,120}target inventory/i,
      /relevant MCP repositories[\s\S]{0,120}exact capability\/limitation semantics/i,
      /Target Runtime Profile[\s\S]{0,120}Live Capability/i,
      /pinned-github[\s\S]{0,160}absent/i,
      /deterministic helpers[\s\S]{0,160}ChatGPT sandbox/i,
      /Dependency Skills separate[\s\S]{0,160}invocation timing/i,
      /agents\/openai\.yaml/i,
      /underlined single-sentence note/i,
      /creating the issue/i,
      /committing implementation changes/i,
      /generating the final runtime bundle/i,
      /storing skills in ChatGPT Library/i,
    ]);
  });

  it("keeps environment mappings semantic and failure behavior explicit", async () => {
    const source = await readFile(ADAPTER, "utf8");

    expectAll(source, [
      /Ephemeral work\s*\|\s*ChatGPT sandbox/i,
      /Repository\/versioned state\s*\|\s*connected GitHub/i,
      /Skill docs\/scripts\/assets\s*\|\s*GitHub-backed skill resources/i,
      /Persistent user deliverable\s*\|\s*ChatGPT Library when appropriate/i,
      /Existing Chrome session\/tabs\s*\|\s*launcher-identified Chrome Browser MCP/i,
      /Dedicated browser automation\s*\|\s*launcher-identified Playwright MCP/i,
      /Independent\/parallel agents[\s\S]{0,160}verified live child workers/i,
      /Host macOS\/files\/native apps\/daemons[\s\S]{0,160}unsupported/i,
      /Storage is not consumption/i,
      /No live \*\*Equivalent Mechanism\*\* => stopped behavior/i,
    ]);

    const template = templateOf(source);
    expect(template).not.toBe("");
    expect(template).not.toMatch(/missing required material|stop without emitting/i);
  });
});
