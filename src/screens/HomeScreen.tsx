import { GameShell } from "~/features/game/GameShell";

export function HomeScreen() {
  return (
    <main className="mx-auto flex min-h-screen w-fit max-w-full flex-col items-start gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <header className="w-full rounded-md border border-slate-800 bg-slate-900/70 px-4 py-3 shadow-2xl shadow-slate-950/40">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Arkini playable blocks</p>
          <span className="rounded-sm border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-300">
            Offline merge economy prototype
          </span>
        </div>
      </header>

      <GameShell />
    </main>
  );
}
