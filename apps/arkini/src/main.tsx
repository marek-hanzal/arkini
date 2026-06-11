import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ensureCrossOriginIsolation } from "./crossOriginIsolation";
import { router } from "./router";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Arkini root element is missing. The DOM has one job. Naturally.");
}

try {
  await ensureCrossOriginIsolation();

  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
} catch (error) {
  createRoot(rootElement).render(
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
      <section className="rounded-3xl border border-red-400/30 bg-red-950/30 p-6 text-red-50">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-200">
          OPFS blocked
        </p>
        <h1 className="mt-3 text-3xl font-bold">Cross-origin isolation failed</h1>
        <p className="mt-4 text-sm leading-6 text-red-100">
          Arkini needs COOP/COEP isolation before browser SQLite can persist into OPFS.
          The service worker fallback tried to help, because apparently even static
          hosting needs a tiny bureaucrat now.
        </p>
        <pre className="mt-4 overflow-auto rounded-2xl bg-red-950/70 p-4 text-xs text-red-100">
          {error instanceof Error ? error.message : String(error)}
        </pre>
      </section>
    </main>,
  );
}
