import { execFile } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readdir, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";
import process from "node:process";

const execFileAsync = promisify(execFile);
const CANONICAL = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COMMIT = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_GIT_METADATA_OUTPUT = 1024 * 1024;

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function isSafeArtifactPath(path) {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\")
  ) {
    return false;
  }
  return path
    .split("/")
    .every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function checkedRepository(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Pinned upstream repository must be a valid URL.");
  }

  if (url.protocol === "file:" && process.env.NODE_ENV === "test") {
    return fileURLToPath(url);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    parts.length !== 2 ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Pinned upstream repository must be an exact https://github.com/<owner>/<repo> URL.",
    );
  }
  return value;
}

async function git(args, options = {}) {
  return execFileAsync("git", args, {
    maxBuffer: MAX_GIT_METADATA_OUTPUT,
    ...options,
  });
}

async function readRequests(skillsRoot) {
  const groups = new Map();
  const entries = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const name = entry.name;
    if (!CANONICAL.test(name)) {
      throw new Error(`Invalid skill directory: ${name}.`);
    }

    const provenancePath = join(skillsRoot, name, "provenance.json");
    let provenance;
    try {
      provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    } catch {
      throw new Error(`Invalid provenance for ${name}.`);
    }

    const repository = checkedRepository(provenance?.upstream?.repository);
    const commit = provenance?.upstream?.commit;
    const location = provenance?.upstream?.location;
    const projection = provenance?.projection;
    if (
      provenance?.name !== name ||
      !COMMIT.test(commit ?? "") ||
      !isSafeArtifactPath(location) ||
      !projection ||
      !isSafeArtifactPath(projection.entrypoint) ||
      !Array.isArray(projection.sources) ||
      projection.sources.length === 0
    ) {
      throw new Error(`Invalid pinned upstream metadata for ${name}.`);
    }

    const entrypoint = projection.sources.find(
      (source) => source?.path === projection.entrypoint,
    );
    if (!entrypoint || entrypoint.upstreamPath !== location) {
      throw new Error(
        `${name}: entrypoint upstreamPath must exactly equal upstream.location.`,
      );
    }

    const key = `${repository}\n${commit}`;
    const group = groups.get(key) ?? {
      repository,
      commit,
      sources: [],
    };

    for (const source of projection.sources) {
      if (
        !isSafeArtifactPath(source?.path) ||
        !isSafeArtifactPath(source?.upstreamPath) ||
        !SHA256.test(source?.sha256 ?? "")
      ) {
        throw new Error(`Invalid pinned source metadata for ${name}.`);
      }

      let local;
      try {
        local = await readFile(join(skillsRoot, name, source.path));
      } catch {
        throw new Error(`Missing pinned source: ${name}/${source.path}.`);
      }
      if (sha256(local) !== source.sha256) {
        throw new Error(`Source integrity mismatch for ${name}/${source.path}.`);
      }

      group.sources.push({
        name,
        path: source.path,
        upstreamPath: source.upstreamPath,
        local,
      });
    }
    groups.set(key, group);
  }

  return [...groups.values()];
}

async function verifyGroup(group) {
  const checkout = await mkdtemp(join(tmpdir(), "pinned-upstream-"));
  try {
    await git(["init", "--quiet", checkout]);
    await git(["-C", checkout, "remote", "add", "origin", group.repository]);
    try {
      await git([
        "-C",
        checkout,
        "fetch",
        "--quiet",
        "--depth=1",
        "origin",
        group.commit,
      ]);
    } catch {
      throw new Error(
        `Cannot fetch pinned upstream ${group.repository}@${group.commit}.`,
      );
    }

    const resolved = (
      await git(["-C", checkout, "rev-parse", "FETCH_HEAD"], {
        encoding: "utf8",
      })
    ).stdout.trim();
    if (resolved !== group.commit) {
      throw new Error(
        `Fetched upstream commit ${resolved} does not equal pinned commit ${group.commit}.`,
      );
    }

    for (const source of group.sources) {
      let upstream;
      try {
        const result = await git(
          ["-C", checkout, "show", `FETCH_HEAD:${source.upstreamPath}`],
          {
            encoding: null,
            maxBuffer: Math.max(
              MAX_GIT_METADATA_OUTPUT,
              source.local.length + 1,
            ),
          },
        );
        upstream = result.stdout;
      } catch {
        throw new Error(
          `Missing pinned upstream source ${group.repository}@${group.commit}:${source.upstreamPath}.`,
        );
      }

      if (!Buffer.isBuffer(upstream) || !source.local.equals(upstream)) {
        throw new Error(
          `${source.name}/${source.path} does not match pinned upstream ${group.repository}@${group.commit}:${source.upstreamPath}.`,
        );
      }
      process.stdout.write(`verified ${source.name}/${source.path}\n`);
    }
  } finally {
    await rm(checkout, { recursive: true, force: true });
  }
}

export async function verifyPinnedUpstreamSources(skillsRoot) {
  const groups = await readRequests(skillsRoot);
  for (const group of groups) {
    await verifyGroup(group);
  }
}

const skillsRoot = process.argv[2] ?? "skills";
verifyPinnedUpstreamSources(skillsRoot).catch((error) => {
  const message = error instanceof Error ? error.message : "Upstream verification failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
