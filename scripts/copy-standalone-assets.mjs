import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";
const nextOutput = path.join(root, distDir);
const standaloneNext = path.join(nextOutput, "standalone", ".next");

await mkdir(standaloneNext, { recursive: true });

const copies = [
  [path.join(nextOutput, "static"), path.join(standaloneNext, "static")],
  [path.join(root, "public"), path.join(nextOutput, "standalone", "public")],
];

for (const [from, to] of copies) {
  if (existsSync(from)) {
    await cp(from, to, { recursive: true, force: true });
  }
}
