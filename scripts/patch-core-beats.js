import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const rootDir = join(import.meta.dirname, "..");

function patchBeatsExport() {
  const pkgPath = join(rootDir, "node_modules", "@hyperframes", "core", "package.json");

  if (!existsSync(pkgPath)) {
    console.log("[patch-core-beats] @hyperframes/core not found, skipping");
    return;
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

  if (pkg.exports && pkg.exports["./beats"]) {
    console.log("[patch-core-beats] ./beats export already exists, skipping");
    return;
  }

  pkg.exports["./beats"] = {
    import: "./dist/beats/index.js",
    types: "./dist/beats/index.d.ts",
  };

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log("[patch-core-beats] added missing ./beats export");
}

patchBeatsExport();
