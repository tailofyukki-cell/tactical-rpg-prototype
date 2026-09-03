import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, "dist", "GridboundTacticsPrototype");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of ["index.html", "src", "data", "assets", "docs", "README.md", "package.json", "tools", "start-windows.bat"]) {
  await cp(join(root, entry), join(out, entry), { recursive: true });
}

await writeFile(join(out, "PLAY.bat"), [
  "@echo off",
  "cd /d \"%~dp0\"",
  "start \"\" \"http://127.0.0.1:4174/\"",
  "npm start"
].join("\r\n"));

console.log(`Packaged prototype: ${out}`);
