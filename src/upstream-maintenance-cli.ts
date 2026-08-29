import { appendFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  checkUpstreamUpdates,
  GitHubApiUpstreamClient,
} from "./upstream-maintenance.js";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error("GITHUB_TOKEN is required.");
}

const skillsRoot =
  process.env.SKILLS_ROOT ??
  fileURLToPath(new URL("../skills/", import.meta.url));
const reportPath =
  process.env.UPSTREAM_REPORT_PATH ?? ".upstream-update-pr.md";

const result = await checkUpstreamUpdates({
  skillsRoot,
  upstream: new GitHubApiUpstreamClient(token),
});

await writeFile(reportPath, result.report, "utf8");

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `changed=${result.changed ? "true" : "false"}\n` +
      `blocked=${result.blocked ? "true" : "false"}\n`,
    "utf8",
  );
}

if (!result.changed) {
  process.stdout.write("No upstream skill changes detected.\n");
} else if (result.blocked) {
  process.stdout.write(
    `Prepared ${result.updates.length} upstream skill update(s); regeneration requires human resolution.\n`,
  );
} else {
  process.stdout.write(
    `Prepared ${result.updates.length} upstream skill update(s).\n`,
  );
}
