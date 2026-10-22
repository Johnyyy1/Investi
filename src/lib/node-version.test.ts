import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

// .nvmrc is the single Node.js version source. CI reads it through setup-node;
// Vercel and the Dockerfile cannot, so these checks keep them on the same major.
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

const readRepositoryFile = (relativePath: string) => readFile(path.join(repositoryRoot, relativePath), "utf8");

async function nodeMajor() {
  const version = (await readRepositoryFile(".nvmrc")).trim();
  expect(version).toMatch(/^\d+$/);
  return version;
}

describe("Node.js version pinning", () => {
  it("pins Vercel and the type definitions to the .nvmrc major", async () => {
    const major = await nodeMajor();
    const manifest = JSON.parse(await readRepositoryFile("package.json")) as {
      engines?: { node?: string };
      devDependencies: Record<string, string>;
    };

    expect(manifest.engines?.node).toBe(`${major}.x`);
    expect(manifest.devDependencies["@types/node"]).toBe(`^${major}`);
  });

  it("builds the development image on the .nvmrc major", async () => {
    const major = await nodeMajor();
    const dockerfile = await readRepositoryFile("Dockerfile");

    expect(dockerfile).toMatch(new RegExp(`^FROM node:${major}-`, "m"));
  });

  it("makes every workflow read the Node.js version from .nvmrc", async () => {
    const workflowDirectory = path.join(repositoryRoot, ".github", "workflows");
    const workflows = (await readdir(workflowDirectory)).filter((file) => /\.ya?ml$/.test(file));

    for (const workflow of workflows) {
      const content = await readFile(path.join(workflowDirectory, workflow), "utf8");
      const setupNodeSteps = content.match(/uses: actions\/setup-node@/g) ?? [];
      const versionFileInputs = content.match(/node-version-file: \.nvmrc$/gm) ?? [];

      expect(content, workflow).not.toMatch(/node-version:/);
      expect(versionFileInputs.length, workflow).toBe(setupNodeSteps.length);
    }
  });
});
