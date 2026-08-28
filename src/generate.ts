import {
  checkGeneratedRuntime,
  listProjectedSkills,
  writeGeneratedRuntime,
} from "./projection.js";

/** Runs the development-time Mechanical Projection command. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const names = args.filter((argument) => argument !== "--check");
  const selected = names.length > 0 ? names : await listProjectedSkills();

  for (const name of selected) {
    if (check) {
      await checkGeneratedRuntime(name);
      process.stdout.write(`verified ${name}\n`);
    } else {
      await writeGeneratedRuntime(name);
      process.stdout.write(`generated ${name}\n`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Generation failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
