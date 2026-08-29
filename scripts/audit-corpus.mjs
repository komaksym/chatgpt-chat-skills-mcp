import { Buffer } from "node:buffer";
import console from "node:console";
import { basename, join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import process from "node:process";

const CANONICAL = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COMMIT = /^[a-f0-9]{40}$/;
const LOCAL_MARKDOWN_LINK = /\]\((?!https?:\/\/|mailto:|#)([^)\s]+\.md(?:#[^)\s]*)?)\)/g;
const LARGE_BLOCK_BYTES = 256;

async function required(root, name, file, errors) {
  try {
    const value = await readFile(join(root, name, file), "utf8");
    if (!value.length) errors.push(name + ": empty " + file);
    return value;
  } catch {
    errors.push(name + ": missing " + file);
    return "";
  }
}

function parseProvenance(name, source, errors) {
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    errors.push(name + ": provenance.json is not valid JSON");
    return null;
  }

  if (
    !value ||
    value.name !== name ||
    !CANONICAL.test(name) ||
    !["public", "hidden"].includes(value.visibility) ||
    !Array.isArray(value.dependencies) ||
    !value.upstream ||
    !COMMIT.test(value.upstream.commit ?? "")
  ) {
    errors.push(name + ": provenance metadata is invalid");
    return null;
  }

  if (
    Object.prototype.hasOwnProperty.call(value, "adaptations") ||
    !value.projection
  ) {
    errors.push(name + ": legacy free-text provenance is forbidden");
    return null;
  }

  if (
    !Array.isArray(value.projection.sources) ||
    value.projection.sources.length === 0 ||
    !Array.isArray(value.projection.changeRecords) ||
    typeof value.projection.entrypoint !== "string"
  ) {
    errors.push(name + ": structured Mechanical Projection metadata is incomplete");
    return null;
  }

  return value;
}

function unresolvedSupportingLinks(runtime, provenance) {
  const sourcePaths = provenance.projection.sources.map((source) => source.path);
  const generatedPaths = new Set(sourcePaths);
  const generatedNames = new Set(sourcePaths.map((path) => basename(path)));
  const inlinedUpstreamNames = new Set([
    basename(provenance.upstream.location).toLowerCase(),
    ...sourcePaths
      .map((path) => basename(path).toLowerCase())
      .filter((name) => name.startsWith("upstream-"))
      .map((name) => name.slice("upstream-".length)),
  ]);

  return [...runtime.matchAll(LOCAL_MARKDOWN_LINK)]
    .map((match) => match[1].split("#", 1)[0].replace(/^\.\//, ""))
    .filter((path) => {
      const name = basename(path);
      if (generatedPaths.has(path) || generatedNames.has(name)) return true;
      return !inlinedUpstreamNames.has(name.toLowerCase());
    });
}

function hasLargeRepeatedBlock(runtime) {
  const seen = new Set();
  for (const block of runtime.split(/\n{2,}/)) {
    const normalized = block.trim();
    if (Buffer.byteLength(normalized, "utf8") < LARGE_BLOCK_BYTES) continue;
    if (seen.has(normalized)) return true;
    seen.add(normalized);
  }
  return false;
}

export async function auditCorpus(root) {
  const errors = [];
  const skills = [];
  const entries = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const name = entry.name;
    const provenanceSource = await required(root, name, "provenance.json", errors);
    const runtime = await required(root, name, "runtime.md", errors);
    await required(root, name, "upstream.md", errors);
    await required(root, name, "LICENSE", errors);

    const provenance = parseProvenance(name, provenanceSource, errors);
    if (!provenance || !runtime) continue;

    const unresolved = unresolvedSupportingLinks(runtime, provenance);
    if (unresolved.length) {
      errors.push(
        name +
          ": unresolved Supporting Document reference: " +
          unresolved.join(", "),
      );
    }
    if (runtime.includes("# Remote execution contract")) {
      errors.push(name + ": Generated Runtime embeds the Runtime Envelope");
    }
    if (hasLargeRepeatedBlock(runtime)) {
      errors.push(name + ": Generated Runtime repeats a large boilerplate block");
    }

    skills.push({
      name,
      visibility: provenance.visibility,
      dependencies: provenance.dependencies,
      runtime,
      runtimeBytes: Buffer.byteLength(runtime, "utf8"),
    });
  }

  const byName = new Map(skills.map((skill) => [skill.name, skill]));
  for (const skill of skills) {
    for (const dependency of skill.dependencies) {
      const child = byName.get(dependency);
      if (!child) {
        errors.push(skill.name + ": unresolved dependency " + dependency);
        continue;
      }
      if (child.runtime.trim() && skill.runtime.includes(child.runtime.trim())) {
        errors.push(skill.name + ": embeds Dependency Skill runtime " + dependency);
      }
    }
  }

  const publicNames = skills
    .filter((skill) => skill.visibility === "public")
    .map((skill) => skill.name);
  if (publicNames.length >= 3) {
    for (const skill of skills) {
      if (publicNames.every((name) => skill.runtime.includes(name))) {
        errors.push(skill.name + ": Generated Runtime embeds the installed public catalog");
      }
    }
  }

  return { errors, skills };
}

const root = process.argv[2] ?? "skills";
const result = await auditCorpus(root);
const publicCount = result.skills.filter((skill) => skill.visibility === "public").length;
const hiddenCount = result.skills.filter((skill) => skill.visibility === "hidden").length;
console.log(
  "Corpus: " +
    result.skills.length +
    " skills (" +
    publicCount +
    " public, " +
    hiddenCount +
    " hidden)",
);
for (const skill of result.skills) {
  console.log(
    "runtime " +
      skill.name +
      ": " +
      skill.runtimeBytes +
      " bytes (~" +
      Math.ceil(skill.runtimeBytes / 4) +
      " tokens)",
  );
}
for (const error of result.errors) console.error("error: " + error);
if (result.errors.length) process.exitCode = 1;
