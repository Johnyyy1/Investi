// Vercel runs `vercel-build` instead of `build` when it exists.
// Production deploys apply pending Drizzle migrations and then the idempotent curriculum seed
// before building, so new code never ships against a schema that lacks its tables or a catalog
// lesson that has no `lesson` row (progress and awards reference it). The seed fails the build
// when any catalog lesson is still missing afterwards. Preview deploys skip both because
// unmerged branches must not change the shared database.
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Reject invalid educational facts before any deployment-side database work.
run("npm", ["run", "check:facts"]);

if (process.env.VERCEL_ENV === "production") {
  console.log("vercel-build: applying database migrations (production deploy)");
  run("npx", ["drizzle-kit", "migrate"]);
  console.log("vercel-build: seeding the curriculum (production deploy)");
  run("npm", ["run", "db:seed"]);
} else {
  console.log(`vercel-build: skipping migrations and curriculum seed (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
}

run("npx", ["next", "build"]);
