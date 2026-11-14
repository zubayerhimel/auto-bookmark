// Packs ../extension into public/auto-bookmark-extension.zip so people can download it from
// /extension and load it unpacked. Runs before `next dev` and `next build`.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(webDir, "..", "extension");
const outFile = join(webDir, "public", "auto-bookmark-extension.zip");
// A fixed timestamp keeps the zip byte-identical between builds when the files haven't changed.
const mtime = new Date("2020-01-01T00:00:00Z");

function collect(dir, files = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path, files);
    else files[relative(sourceDir, path).split(sep).join("/")] = [readFileSync(path), { mtime }];
  }
  return files;
}

let files;
try {
  files = collect(sourceDir);
} catch (error) {
  throw new Error(
    `Couldn't read the extension at ${sourceDir}. On Vercel, keep "Include files outside the root directory" enabled.`,
    { cause: error },
  );
}
if (!files["manifest.json"]) throw new Error(`No manifest.json in ${sourceDir}.`);

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, zipSync(files, { level: 9 }));
console.log(`Packed ${Object.keys(files).length} extension files into public/auto-bookmark-extension.zip`);
