/**
 * Builds `netlify_deploy/` for static hosting:
 * - Copies everything from `public/` to the folder root (so `/` is `index.html`)
 * - Copies `src/` to `netlify_deploy/src/` (so `/src/main.js` works)
 *
 * Run from `deskhub_starter_1`: npm run build:netlify
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pub = path.join(root, "public");
const out = path.join(root, "netlify_deploy");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of fs.readdirSync(pub)) {
  fs.cpSync(path.join(pub, name), path.join(out, name), { recursive: true });
}

const srcDir = path.join(root, "src");
if (fs.existsSync(srcDir)) {
  fs.cpSync(srcDir, path.join(out, "src"), { recursive: true });
} else {
  console.warn("Warning: no src/ folder — /src/main.js will 404.");
}

console.log(`Done. Deploy this folder: ${out}`);
