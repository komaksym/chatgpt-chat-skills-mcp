import { readFile } from "node:fs/promises";

import { REMOTE_EXECUTION_CONTRACT } from "./contract.js";

const SKILLS_ROOT = new URL("../skills/", import.meta.url);

export interface PublicSkill {
  description: string;
  name: string;
}

export const PUBLIC_SKILLS: readonly PublicSkill[] = [
  {
    name: "handoff",
    description: "Create a compact continuation brief for another conversation.",
  },
];

/** Loads the compact prompt for the requested bundled skill. */
export async function loadSkill(name: string): Promise<string> {
  if (name !== "handoff") {
    throw new Error(`Unknown skill: ${name}.`);
  }

  const runtime = await readFile(new URL("handoff/runtime.md", SKILLS_ROOT), "utf8");
  return `${REMOTE_EXECUTION_CONTRACT}\n\n# ${name}\n\n${runtime.trim()}\n`;
}
