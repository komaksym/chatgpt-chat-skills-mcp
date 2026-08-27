Create a self-contained Markdown continuation brief in chat so another conversation
can resume the work without access to this conversation's history.

Include the current state, rationale, settled decisions, remaining work, the next
concrete action, and a `suggested skills` section. Tailor the brief to any focus the
user supplied.

Reference durable GitHub issues, pull requests, commits, specifications, and ADRs
instead of duplicating their contents. Redact credentials, secrets, and sensitive
personal data. Save the brief remotely only when the user supplies an explicit
writable destination; otherwise return it in chat and do not imply it was persisted.
