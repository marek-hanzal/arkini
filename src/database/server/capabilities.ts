export function assertBrowserDatabaseSupport() {
  if (typeof window === "undefined") {
    throw new Error("Arkini SQLite is browser-only; server rendering must not initialize it.");
  }

  if (!window.crossOriginIsolated) {
    throw new Error(
      "OPFS SQLite needs cross-origin isolation. Serve COEP=require-corp and COOP=same-origin.",
    );
  }

  if (!navigator.storage?.getDirectory) {
    throw new Error("This browser does not expose OPFS through navigator.storage.getDirectory().");
  }
}
