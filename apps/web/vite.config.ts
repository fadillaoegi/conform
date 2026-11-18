import { defineConfig, defaultClientConditions } from "vite";

// The checker (@conform/core) is consumed from its TypeScript sources through the
// "conform-source" export condition, so the site always runs the code the tests run.
export default defineConfig({
  resolve: {
    conditions: ["conform-source", ...defaultClientConditions],
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    // Serve every asset (fonts included) as a file, so the page CSP can keep font-src and img-src to 'self'.
    assetsInlineLimit: 0,
    // The reference runtime's LangChain bundle is a lazy chunk the checker never loads.
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
    // The Conform service (apps/server) answers these in development.
    proxy: Object.fromEntries(["/api", "/mcp", "/badges", "/.well-known/conform-badge-key.json", "/healthz"].map((p) => [p, "http://127.0.0.1:8787"])),
  },
});
