import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const targets = [
  path.join(projectRoot, ".next", "dev"),
  path.join(projectRoot, "tsconfig.tsbuildinfo"),
];

for (const target of targets) {
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
}

console.log("[dev-clean] Cleared .next/dev cache and tsconfig.tsbuildinfo");
