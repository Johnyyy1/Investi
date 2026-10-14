// Vercel runs `vercel-build` instead of `build` when it exists.
// Production deploys apply pending Drizzle migrations before building, so new code never
// ships against a schema that lacks its tables. Preview deploys skip migrations because
// unmerged branches must not change the shared database.
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
  console.log("vercel-build: applying database migrations (production deploy)");
  run("npx", ["drizzle-kit", "migrate"]);
} else {
  console.log(`vercel-build: skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
}

run("npx", ["next", "build"]);
