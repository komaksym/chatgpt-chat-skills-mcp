import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const ADAPTER = new URL("../docs/adapt-codex-skill.md", import.meta.url);

describe("Codex-to-ChatGPT adaptation-spec skill", () => {
  it("states the complete issue #44 contract at the external Markdown seam", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const required = [
      "name: adapt-codex-skill",
      "sole successful output is the Adaptation Spec",
      "must not create a GitHub issue",
      "must not commit repository changes",
      "must not generate the final runtime bundle",
      "must not store skills in ChatGPT Library",
      "complete Upstream Skill Bundle",
      "What concrete target-runtime constraint forces this change?",
      "mcps-launcher",
      "individual MCP repositories",
      "Target Runtime Profile",
      "Live Capability",
      "ChatGPT sandbox",
      "connected GitHub",
      "ChatGPT Library",
      "Repository Assets",
      "Chrome Browser MCP",
      "Playwright MCP",
      "Dependency Skills",
      "agents/openai.yaml",
      "host macOS",
      "deterministic",
      "Source Provenance",
      "pinned-github",
      "absent",
      "stop without emitting an Adaptation Spec",
      "underlined, single-sentence note",
    ];

    const missing = required.filter((fragment) => !source.includes(fragment));
    expect(missing).toEqual([]);
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

  it("keeps missing-input stopped behavior out of the success-only Adaptation Spec template", async () => {
    const source = await readFile(ADAPTER, "utf8");
    const template = source.match(
      /<adaptation-spec-template>\n(?<body>[\s\S]*?)\n<\/adaptation-spec-template>/,
    )?.groups?.body;

    expect(source).toContain("stop without emitting an Adaptation Spec");
    expect(template).toBeDefined();
    expect(template).not.toMatch(/missing upstream material[\s\S]{0,120}stopp?ed/i);
  });
});
