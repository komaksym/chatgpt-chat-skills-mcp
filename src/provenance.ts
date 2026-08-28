import * as z from "zod/v4";

export const CANONICAL_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/** Accepts repository-relative artifact paths without traversal or platform escapes. */
function isSafeArtifactPath(path: string): boolean {
  if (path.startsWith("/") || path.includes("\\")) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

const artifactPathSchema = z.string().min(1).refine(isSafeArtifactPath);
const adrArtifactPathSchema = artifactPathSchema.refine(
  (path) => path.startsWith("docs/adr/") && path.endsWith(".md"),
);

const replaceExactSchema = z.strictObject({
  type: z.literal("replace-exact"),
  match: z.string().min(1),
  replacement: z.string(),
});

const appendSourceSchema = z.strictObject({
  type: z.literal("append-source"),
  separator: z.string(),
});

const changeRecordSchema = z.strictObject({
  allowedRuntimeChange: z.enum([
    "inline-supporting-document",
    "translate-invocation-or-tool",
    "equivalent-mechanism",
    "select-upstream-supported-branch",
  ]),
  source: artifactPathSchema,
  evidence: z.string().min(1),
  transform: z.discriminatedUnion("type", [replaceExactSchema, appendSourceSchema]),
});

const sourceArtifactSchema = z.strictObject({
  path: artifactPathSchema,
  sha256: z.string().regex(SHA256),
});

const temporaryUpstreamFixSchema = z.strictObject({
  upstreamCommit: z.string().regex(COMMIT_SHA),
  source: artifactPathSchema,
  adr: adrArtifactPathSchema,
  test: artifactPathSchema,
  transform: replaceExactSchema,
});

export const projectionSchema = z.strictObject({
  entrypoint: artifactPathSchema,
  sources: z.array(sourceArtifactSchema).min(1),
  changeRecords: z.array(changeRecordSchema),
  temporaryUpstreamFix: temporaryUpstreamFixSchema.optional(),
});

export const provenanceSchema = z.strictObject({
  name: z.string().regex(CANONICAL_NAME),
  visibility: z.enum(["public", "hidden"]),
  description: z.string().min(1),
  dependencies: z.array(z.string().regex(CANONICAL_NAME)),
  upstream: z.strictObject({
    repository: z.url(),
    location: z.string().min(1),
    commit: z.string().regex(COMMIT_SHA),
  }),
  license: z.string().min(1),
  attribution: z.string().min(1),
  adaptations: z.array(z.string().min(1)),
  projection: projectionSchema.optional(),
});

export type SkillProvenance = z.infer<typeof provenanceSchema>;
