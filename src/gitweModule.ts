/**
 * gitwe ships as a pure ESM package (no CommonJS build). The VS Code
 * extension host loads extensions as CommonJS, and a CJS module can only
 * load pure ESM via a genuine dynamic `import()` — never `require()`, which
 * throws ERR_REQUIRE_ESM. So every runtime (non type-only) use of "gitwe"
 * goes through this lazily-cached loader instead of a static import.
 */
let modulePromise: Promise<typeof import("gitwe")> | undefined;

export function loadGitwe(): Promise<typeof import("gitwe")> {
  if (!modulePromise) {
    modulePromise = import("gitwe");
  }
  return modulePromise;
}
