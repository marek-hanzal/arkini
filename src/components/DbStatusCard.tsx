import { useState } from "react";
import { useArkiniDatabaseStatus } from "~/hooks/useArkiniDatabaseStatus";

export function DbStatusCard() {
  const status = useArkiniDatabaseStatus();
  const [resetState, setResetState] = useState<"idle" | "pending" | "failed">("idle");

  const crossOriginIsolated = typeof window === "undefined" ? false : window.crossOriginIsolated === true;

  async function hardResetDatabase() {
    setResetState("pending");

    try {
      const db = await import("~/domains/database");
      await db.hardResetDatabaseFile();
      window.location.reload();
    } catch (error) {
      console.error(error);
      setResetState("failed");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-xl shadow-slate-950/30">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Local database</p>
          <h2 className="mt-1 text-lg font-semibold text-white">SQLite / OPFS</h2>
        </div>
        <StatusPill label="DB" value={status.isSuccess ? status.data.databasePath : "arkini.sqlite3"} />
        <StatusPill label="Sync" value={status.isSuccess ? status.data.gameDataHash.slice(0, 10) : "pending"} />
        <StatusPill label="Items" value={status.isSuccess ? String(status.data.itemCount) : "…"} />
        <StatusPill label="Prod" value={status.isSuccess ? String(status.data.producerCount) : "…"} />
        <span
          className={[
            "rounded-full px-3 py-1 text-xs font-semibold",
            crossOriginIsolated ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200",
          ].join(" ")}
        >
          {crossOriginIsolated ? "isolated" : "headers missing"}
        </span>
        <button
          type="button"
          disabled={resetState === "pending"}
          onClick={hardResetDatabase}
          className="rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-100 transition hover:border-red-300 hover:bg-red-950/50 disabled:cursor-wait disabled:opacity-60"
        >
          {resetState === "pending" ? "Dropping DB…" : "Hard reset DB"}
        </button>
      </div>

      {status.isError ? <p className="mt-3 text-sm text-red-100">{(status.error as Error).message}</p> : null}
      {resetState === "failed" ? <p className="mt-3 text-sm text-red-100">Hard reset failed. Check the browser console.</p> : null}
    </section>
  );
}

function StatusPill({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-20 rounded-xl bg-slate-950/60 px-3 py-2">
      <div className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="truncate text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}
