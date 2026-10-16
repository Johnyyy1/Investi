import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const sourceRoot = path.join(repositoryRoot, "src");

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(location) : [location];
  }));
  return nested.flat().filter((file) => /\.(ts|tsx)$/.test(file));
}

describe("market-data architecture boundary", () => {
  it("marks every provider, service, cache and deterministic fixture module as server-only", async () => {
    const serverModules = [
      "provider.ts",
      "cache.ts",
      "composition.ts",
      "environment.ts",
      "market-session.ts",
      "postgres-cache.ts",
      "readiness.ts",
      "service.ts",
      "deterministic/fixtures.ts",
      "deterministic/fundamentals.ts",
      "deterministic/provider.ts",
      "deterministic/service.ts",
      "fmp/client.ts",
      "fmp/equity-fundamentals.ts",
      "fmp/provider.ts",
      "cnb/client.ts",
      "cnb/parse.ts",
      "cnb/provider.ts",
      "frankfurter/client.ts",
      "frankfurter/provider.ts",
      "frankfurter/service.ts",
    ];
    for (const modulePath of serverModules) {
      const source = await readFile(path.join(sourceRoot, "features/market-data", modulePath), "utf8");
      expect(source, modulePath).toMatch(/^import "server-only";/);
    }
  });

  it("keeps provider implementations out of every client component graph", async () => {
    const files = await sourceFiles(sourceRoot);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (!/^"use client";/.test(source)) continue;
      expect(source, path.relative(repositoryRoot, file)).not.toMatch(/features\/market-data\/(?:cache|postgres-cache|composition|environment|service|provider|deterministic|fmp|frankfurter|cnb)/);
    }
  });

  it("keeps the Portfolio Lab composition and market operations server-only", async () => {
    for (const modulePath of ["environment.ts", "market-data.ts", "repository.ts", "service.ts"]) {
      const source = await readFile(path.join(sourceRoot, "features/portfolio", modulePath), "utf8");
      expect(source, modulePath).toMatch(/^import "server-only";/);
    }
  });

  it("does not install a vendor market-data SDK", async () => {
    const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    const packageNames = Object.keys(manifest.dependencies).join(" ").toLocaleLowerCase("en-US");
    expect(packageNames).not.toMatch(/yahoo|twelve.?data|alpha.?vantage|polygon|finnhub/);
  });
});
