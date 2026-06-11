import { useArkiniDatabaseStatus } from "~/hooks/useArkiniDatabaseStatus";

export function DbStatusCard() {
  const status = useArkiniDatabaseStatus();

  const crossOriginIsolated =
    typeof window === "undefined" ? false : window.crossOriginIsolated === true;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            Local database
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">SQLite / OPFS</h2>
        </div>
        <div
          className={[
            "rounded-full px-3 py-1 text-xs font-semibold",
            crossOriginIsolated ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200",
          ].join(" ")}
        >
          {crossOriginIsolated ? "isolated" : "headers missing"}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <StatusPill label="DB" value={status.isSuccess ? status.data.databasePath : "arkini.sqlite3"} />
        <StatusPill label="Migrations" value={status.isSuccess ? status.data.migrationState : "pending"} />
        <StatusPill label="Assets" value={status.isSuccess ? String(status.data.assetCount) : "…"} />
        <StatusPill label="Items" value={status.isSuccess ? String(status.data.itemCount) : "…"} />
      </div>

      {status.isError ? (
        <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-100">
          {(status.error as Error).message}
        </p>
      ) : null}
    </section>
  );
}

function StatusPill({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 truncate font-medium text-slate-100">{value}</div>
    </div>
  );
}
