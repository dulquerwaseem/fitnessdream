// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// @lovable.dev/vite-tanstack-config's defineConfig() checks isSandboxEnvironment()
// (LOVABLE_SANDBOX === "1" or DEV_SERVER__PROJECT_PATH set — see
// node_modules/@lovable.dev/vite-tanstack-config/dist/index.cjs, isSandboxEnvironment
// around line 345, and the build-time branch around line 1208-1239) and, when true,
// hard-overrides nitroOpts.preset to "cloudflare-module" regardless of what's set
// below. We deploy to Hostinger's Node.js hosting, so that override must never win
// here. Clearing these before defineConfig() is invoked (Vite calls the function
// defineConfig() returns, not defineConfig() itself, so this runs first) makes
// isSandboxEnvironment() resolve false, keeping our "node-server" preset intact
// even if something in the build environment sets either variable.
delete process.env.LOVABLE_SANDBOX;
delete process.env.DEV_SERVER__PROJECT_PATH;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Target Node.js (Hostinger) instead of the Cloudflare Workers default.
  nitro: {
    preset: "node-server",
  },
});
