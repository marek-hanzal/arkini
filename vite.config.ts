import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import sqlocal from "sqlocal/vite";
import { defineConfig } from "vite";

const crossOriginIsolationHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
} as const;

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
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
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    // SQLocal wires browser SQLite workers and enables OPFS-friendly dev headers.
    sqlocal(),
    tailwindcss(),
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
