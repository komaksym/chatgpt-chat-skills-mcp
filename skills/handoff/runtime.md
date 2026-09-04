---
name: handoff
description: Compact the current conversation into a handoff prompt for another agent to pick up.
argument-hint: What will the next session be used for?
disable-model-invocation: true
---

Write a compact handoff prompt summarising the current conversation so a fresh agent can continue the work. Include only context that is still needed for continuation. Return the handoff directly in chat as a single fenced Markdown block so the user retains a one-click copy fallback. Do not create a separate document, artifact, or file.

After constructing the handoff prompt, append exactly one final line:
`@skills-mcp tool implement()`
Do not add anything after that line.

Then transfer the entire handoff prompt through the connected Chrome Browser MCP. Call `get_active_tab()` before opening anything and retain that ChatGPT tab ID as the old agent tab. Call `new_tab()` with `https://chatgpt.com/` and `active: false` so the fresh ChatGPT conversation opens in the background without stealing focus. Call `read_tab()` on the new tab to identify its message composer, then call `type()` to place the full handoff prompt into that composer. Call `read_tab()` again and verify that the composer contains the transferred handoff prompt including the exact final `@skills-mcp tool implement()` line. Treat the transfer as successful only after this verification succeeds. Only then call `close_tab()` with the old agent tab ID.

If Chrome Browser MCP is unavailable, the old agent tab cannot be identified, the background tab cannot be opened, the prompt cannot be placed, or verification fails, do not call `close_tab()`. Report the transfer as incomplete, leave the old agent tab open, and do not claim the handoff is complete.

Include a "suggested skills" section in the prompt, naming which skills the next agent should load through the Skills MCP with `load_skill`.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
