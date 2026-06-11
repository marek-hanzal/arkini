import { GameShell } from "~/components/GameShell";

const overviewPills = [
  "Board merge",
  "Limited inventory",
  "Blueprint builds",
  "Cooldown producers",
];

export function HomeScreen() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/50 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300 sm:text-sm">
              Arkini playable blocks
            </p>
            <div className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-300">
              Client-only SPA + OPFS SQLite
            </div>
          </div>

          <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Offline merge economy prototype
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Board merge, limited inventory, blueprint building, cooldown producers, finite crates,
            and manifest-synced SQLite definitions. The priority is a tight playable loop, not a heroic
            landing page that eats half the viewport before the game even starts.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {overviewPills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-300"
              >
                {pill}
              </span>
            ))}
          </div>
        </section>
      </header>

      <GameShell />
    </main>
  );
}
