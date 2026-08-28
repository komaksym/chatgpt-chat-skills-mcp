import { constants, type Dirent } from "node:fs";
import { open, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { REMOTE_EXECUTION_CONTRACT } from "./contract.js";
import {
  CANONICAL_NAME,
  parseSkillProvenance,
  type SkillProvenance,
} from "./provenance.js";

const DEFAULT_SKILLS_ROOT = fileURLToPath(new URL("../skills/", import.meta.url));

interface SkillBundle {
  metadata: SkillProvenance;
  runtime: string;
}

export interface PublicSkill {
  description: string;
  name: string;
}

/** Orders public skills by canonical name for deterministic listings. */
function comparePublicSkills(left: PublicSkill, right: PublicSkill): number {
  return left.name.localeCompare(right.name);
}

/** Orders filesystem entries so validation selects failures deterministically. */
function compareDirectoryEntries(left: Dirent, right: Dirent): number {
  return left.name.localeCompare(right.name);
}

/** Reads a required regular file without following a bundle-level symlink. */
async function readBundleFile(path: string, label: string): Promise<string> {
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw new Error(`Missing ${label}.`);
  }

  try {
    const status = await file.stat();
    if (!status.isFile()) {
      throw new Error(`${label} must be a regular file.`);
    }
    const content = await file.readFile("utf8");
    if (content.length === 0) {
      throw new Error(`${label} must not be empty.`);
    }
    return content;
  } finally {
    await file.close();
  }
}

/** Parses and validates one bundle's provenance metadata and runtime artifact. */
async function readBundle(root: string, directory: string): Promise<SkillBundle> {
  const bundlePath = join(root, directory);
  let source: string;
  try {
    source = await readBundleFile(
      join(bundlePath, "provenance.json"),
      "provenance.json",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid metadata.";
    throw new Error(`Invalid skill bundle "${directory}": ${message}`);
  }

  const parsed = parseSkillProvenance(source);
  if (!parsed.success) {
    if (parsed.reason === "invalid-json") {
      throw new Error(
        `Invalid skill bundle "${directory}": provenance.json must contain valid JSON.`,
      );
    }
    throw new Error(`Invalid skill bundle "${directory}": metadata is invalid.`);
  }
  if (parsed.data.description.includes("\n")) {
    throw new Error(`Invalid skill bundle "${directory}": metadata is invalid.`);
  }

  let runtime: string;
  try {
    runtime = await readBundleFile(join(bundlePath, "runtime.md"), "runtime.md");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid runtime.";
    throw new Error(`Invalid skill bundle "${directory}": ${message}`);
  }
  return { metadata: parsed.data, runtime };
}

/** Represents a validated, read-only set of installed skill bundles. */
export class SkillCatalog {
  readonly #bundles: ReadonlyMap<string, SkillBundle>;

  /** Captures the immutable validated name-to-bundle mapping. */
  constructor(bundles: ReadonlyMap<string, SkillBundle>) {
    this.#bundles = bundles;
  }

  /** Returns only public names and descriptions in deterministic order. */
  listPublic(): PublicSkill[] {
    const skills: PublicSkill[] = [];
    for (const bundle of this.#bundles.values()) {
      if (bundle.metadata.visibility === "public") {
        skills.push({
          name: bundle.metadata.name,
          description: bundle.metadata.description,
        });
      }
    }
    return skills.sort(comparePublicSkills);
  }

  /** Loads exactly one validated runtime without reading caller-derived paths. */
  async load(name: string): Promise<string> {
    const bundle = CANONICAL_NAME.test(name) ? this.#bundles.get(name) : undefined;
    if (!bundle) {
      throw new Error(`Unknown skill: ${name}.`);
    }
    return `${REMOTE_EXECUTION_CONTRACT}\n\n# ${name}\n\n${bundle.runtime.trim()}\n`;
  }
}

/** Discovers and validates all direct child bundles before serving requests. */
export async function discoverCatalog(
  skillsRoot: string = DEFAULT_SKILLS_ROOT,
): Promise<SkillCatalog> {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  entries.sort(compareDirectoryEntries);
  const bundles = new Map<string, SkillBundle>();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const bundle = await readBundle(skillsRoot, entry.name);
    if (bundles.has(bundle.metadata.name)) {
      throw new Error(`Duplicate skill name: ${bundle.metadata.name}.`);
    }
    bundles.set(bundle.metadata.name, bundle);
  }

  for (const bundle of bundles.values()) {
    for (const dependency of bundle.metadata.dependencies) {
      if (!bundles.has(dependency)) {
        throw new Error(
          `Skill ${bundle.metadata.name} depends on unknown skill: ${dependency}.`,
        );
      }
    }
  }

  return new SkillCatalog(bundles);
}
