export interface ProjectionOptions {
  repositoryRoot?: string;
  skillsRoot?: string;
}

/** Generates one committed runtime candidate from its pinned upstream bundle. */
export async function generateSkillRuntime(
  _name: string,
  _options: ProjectionOptions = {},
): Promise<string> {
  throw new Error("Mechanical Projection generator is not implemented.");
}
