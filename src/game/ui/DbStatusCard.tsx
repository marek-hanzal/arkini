import { useState } from "react";
import { cn } from "~/shared/cn";
import { useArkiniDatabaseStatus } from "~/game/hook/useArkiniDatabaseStatus";

export function DbStatusCard() {
  const status = useArkiniDatabaseStatus();
  const [resetState, setResetState] = useState<"idle" | "pending" | "failed">("idle");
  const isolated = typeof window !== "undefined" && window.crossOriginIsolated === true;

  async function resetDb() {
    setResetState("pending");

    try {
      const db = await import("~/game/server/gameServer");
      await db.hardResetDatabaseFile();
      window.location.reload();
    } catch (error) {
      console.error(error);
      setResetState("failed");
    }
  }

  return (
    <section className="w-full rounded-md border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-slate-950/25">
      <div className="flex h-full flex-wrap items-center gap-4">
        <div className="min-w-40">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">Local database</p>
          <h2 className="mt-1 text-base font-semibold text-white">SQLite / OPFS</h2>
          <span
            className={cn(
              "mt-2 inline-flex rounded-sm px-2 py-1 text-xs font-semibold",
              isolated ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200",
            )}
          >
            {isolated ? "isolated" : "headers missing"}
          </span>
        </div>

        <div className="grid min-w-64 flex-1 grid-cols-2 gap-2">
          <StatusPill label="DB" value={status.isSuccess ? status.data.databasePath : "arkini.sqlite3"} />
          <StatusPill label="Sync" value={status.isSuccess ? status.data.gameDataHash.slice(0, 10) : "pending"} />
          <StatusPill label="Items" value={status.isSuccess ? String(status.data.itemCount) : "…"} />
          <StatusPill label="Prod" value={status.isSuccess ? String(status.data.producerCount) : "…"} />
        </div>

        <button
          type="button"
          disabled={resetState === "pending"}
          onClick={resetDb}
          className="rounded-sm border border-red-400/30 bg-red-950/30 px-6 py-3 text-sm font-semibold text-red-100 hover:border-red-300 hover:bg-red-950/50 disabled:cursor-wait disabled:opacity-60"
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
    <div className="min-w-0 rounded-sm bg-slate-950/60 px-3 py-2">
      <div className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="truncate text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}
