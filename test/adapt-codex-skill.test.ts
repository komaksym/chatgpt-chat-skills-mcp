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
      "spawn_agents",
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
});
