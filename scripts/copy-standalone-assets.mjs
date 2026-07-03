import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneNext = path.join(root, ".next", "standalone", ".next");

await mkdir(standaloneNext, { recursive: true });

const copies = [
  [path.join(root, ".next", "static"), path.join(standaloneNext, "static")],
  [path.join(root, "public"), path.join(root, ".next", "standalone", "public")],
];

for (const [from, to] of copies) {
  if (existsSync(from)) {
    await cp(from, to, { recursive: true, force: true });
  }
}
