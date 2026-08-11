const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: "dist/extension.js",
    // "gitwe" is kept external (not inlined) because it locates its built-in
    // preset YAML files (.gitwe/preset/*.yaml) at runtime relative to its own
    // package directory. Bundling it in would break that path resolution, so
    // it — and its own runtime dependencies — ship inside node_modules in the
    // packaged .vsix instead (see .vscodeignore).
    external: ["vscode", "gitwe"],
    sourcemap: !production,
    minify: production,
    logLevel: "info",
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
