export interface ProjectionOptions {
  repositoryRoot?: string;
  skillsRoot?: string;
}

/** Generates one committed runtime candidate from its pinned upstream bundle. */
export async function generateSkillRuntime(
  name: string,
  options: ProjectionOptions = {},
): Promise<string> {
  void name;
  void options;
  throw new Error("Mechanical Projection generator is not implemented.");
}
