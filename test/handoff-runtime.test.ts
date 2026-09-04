import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { generateSkillRuntime } from "../src/projection.js";

const HANDOFF_ROOT = new URL("../skills/handoff/", import.meta.url);

/** Loads the mechanically generated handoff runtime. */
async function handoffRuntime(): Promise<string> {
  return generateSkillRuntime("handoff");
}

describe("handoff fresh-session runtime", () => {
  it("retains the requested public contract and committed generated runtime", async () => {
    const runtime = await handoffRuntime();
    const committed = await readFile(new URL("runtime.md", HANDOFF_ROOT), "utf8");

    expect(runtime).toContain(
      [
        "---",
        "name: handoff",
        "description: Compact the current conversation into a handoff prompt for another agent to pick up.",
        "argument-hint: What will the next session be used for?",
        "disable-model-invocation: true",
        "---",
      ].join("\n"),
    );
    expect(committed).toBe(runtime);
  });

  it("constructs only the compact continuation context and keeps suggested skills", async () => {
    const runtime = await handoffRuntime();

    expect(runtime).toContain("Include only context that is still needed for continuation.");
    expect(runtime).toContain('Include a "suggested skills" section in the prompt');
    expect(runtime).toContain("load through the Skills MCP with `load_skill`");
  });

  it("references durable artifacts instead of duplicating them", async () => {
    const runtime = await handoffRuntime();

    expect(runtime).toContain(
      "Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs).",
    );
    expect(runtime).toContain("Reference them by path or URL instead.");
  });

  it("requires secret and PII redaction", async () => {
    const runtime = await handoffRuntime();

    expect(runtime).toContain("Redact any sensitive information");
    expect(runtime).toContain("API keys, passwords, or personally identifiable information");
  });

  it("uses user arguments as the next-session focus", async () => {
    const runtime = await handoffRuntime();

    expect(runtime).toContain("If the user passed arguments");
    expect(runtime).toContain("what the next session will focus on");
    expect(runtime).toContain("tailor the doc accordingly");
  });

  it("opens the fresh ChatGPT conversation in a background Chrome tab", async () => {
    const runtime = await handoffRuntime();

    expect(runtime).toContain("Call `get_active_tab()` before opening anything");
    expect(runtime).toContain("Call `new_tab()` with `https://chatgpt.com/` and `active: false`");
    expect(runtime).toContain("without stealing focus");
  });

  it("places and verifies the exact implementation handoff before closing the old tab", async () => {
    const runtime = await handoffRuntime();
    const append = runtime.indexOf("@skills-mcp tool implement()");
    const type = runtime.indexOf("Call `type()`");
    const verify = runtime.indexOf("Treat the transfer as successful only after this verification succeeds.");
    const close = runtime.indexOf("call `close_tab()` with the old agent tab ID");

    expect(append).toBeGreaterThan(-1);
    expect(type).toBeGreaterThan(append);
    expect(verify).toBeGreaterThan(type);
    expect(close).toBeGreaterThan(verify);
    expect(runtime).toContain("Do not add anything after that line.");
  });

  it("leaves the old tab open and reports incomplete transfer on browser failure", async () => {
    const runtime = await handoffRuntime();

    expect(runtime).toContain("If Chrome Browser MCP is unavailable");
    expect(runtime).toContain("do not call `close_tab()`");
    expect(runtime).toContain("leave the old agent tab open");
    expect(runtime).toContain("do not claim the handoff is complete");
  });
});
