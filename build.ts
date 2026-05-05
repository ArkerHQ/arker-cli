import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

const outfile = path.resolve(import.meta.dirname, "dist/main.js");

await esbuild.build({
  entryPoints: [path.resolve(import.meta.dirname, "src/main.ts")],
  bundle: true,
  outfile,
  format: "esm",
  platform: "node",
  target: "node18",
  minify: false,
  sourcemap: false,
  banner: { js: "#!/usr/bin/env node" },
  external: [],
});

const stat = fs.statSync(outfile);
const kb = (stat.size / 1024).toFixed(1);
console.log(`Built ${outfile} (${kb} KB)`);
