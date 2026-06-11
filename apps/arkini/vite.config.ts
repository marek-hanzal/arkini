import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import sqlocal from "sqlocal/vite";
import { defineConfig } from "vite";

const crossOriginIsolationHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
} as const;

export default defineConfig({
  clearScreen: false,
  server: {
    port: 4040,
    strictPort: true,
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    port: 4040,
    strictPort: true,
    headers: crossOriginIsolationHeaders,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    sqlocal(),
    tailwindcss(),
    // React plugin must stay after TanStack Start.
    viteReact(),
  ],
  build: {
    target: "esnext",
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["sqlocal"],
  },
});
