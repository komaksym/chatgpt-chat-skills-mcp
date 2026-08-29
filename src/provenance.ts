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
const focusedTestArtifactPathSchema = artifactPathSchema.refine((path) =>
  /^(?:test|tests)\/.+\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(path),
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

export const TARGET_RUNTIME_PROFILE_ID = "chatgpt-web-mcp-v1" as const;

const targetRuntimeConstraintSchema = z.enum([
  "chatgpt-web-through-mcp",
  "only-load-skill-and-list-skills",
  "github-repository-and-issue-tracker",
  "no-local-checkout",
  "no-shell",
  "no-filesystem",
  "no-git-cli",
  "no-background-process",
  "no-connected-tool-assumption",
  "no-write-access-assumption",
]);

const targetRuntimeEvidenceSchema = z.strictObject({
  targetRuntimeProfile: z.literal(TARGET_RUNTIME_PROFILE_ID),
  constraints: z.array(targetRuntimeConstraintSchema).min(1),
  incompatibility: z.string().min(1),
});

const changeRecordSchema = z.strictObject({
  allowedRuntimeChange: z.enum([
    "inline-supporting-document",
    "translate-invocation-or-tool",
    "equivalent-mechanism",
    "select-upstream-supported-branch",
  ]),
  source: artifactPathSchema,
  evidence: targetRuntimeEvidenceSchema,
  transform: z.discriminatedUnion("type", [replaceExactSchema, appendSourceSchema]),
});

const sourceArtifactSchema = z.strictObject({
  path: artifactPathSchema,
  upstreamPath: artifactPathSchema,
  sha256: z.string().regex(SHA256),
});

const dependencyPinSchema = z.strictObject({
  name: z.string().regex(CANONICAL_NAME),
  upstreamCommit: z.string().regex(COMMIT_SHA),
});

const temporaryUpstreamFixSchema = z.strictObject({
  upstreamCommit: z.string().regex(COMMIT_SHA),
  dependencyPins: z.array(dependencyPinSchema).optional(),
  source: artifactPathSchema,
  adr: adrArtifactPathSchema,
  test: focusedTestArtifactPathSchema,
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
  projection: projectionSchema,
});

export type SkillProvenance = z.infer<typeof provenanceSchema>;

export type ProvenanceParseResult =
  | { data: SkillProvenance; success: true }
  | { reason: "invalid-json" | "invalid-metadata"; success: false };

/** Parses and validates one provenance document without imposing caller policy. */
export function parseSkillProvenance(source: string): ProvenanceParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return { reason: "invalid-json", success: false };
  }

  const parsed = provenanceSchema.safeParse(raw);
  if (!parsed.success) {
    return { reason: "invalid-metadata", success: false };
  }
  return { data: parsed.data, success: true };
}
