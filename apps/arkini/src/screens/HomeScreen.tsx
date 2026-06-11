import { DbStatusCard } from "~/components/DbStatusCard";
import { GameShell } from "~/components/GameShell";

export function HomeScreen() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
      <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
          Arkini playable blocks
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Offline merge economy prototype
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Board merge, limited inventory, blueprint building, cooldown producers, finite crates,
              and manifest-synced SQLite definitions. Pořád je to button-first prototyp, ne hotová
              hra, takže klid, grafická extáze přijde později a bude stát další kus duše.
            </p>
          </div>
          <DbStatusCard />
        </div>
      </header>

      <GameShell />
    </main>
  );
}
