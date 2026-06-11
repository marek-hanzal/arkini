export function SplashScreen() {
  return (
    <section className="flex h-[38rem] w-[72rem] max-w-full items-center justify-center rounded-md border border-slate-800 bg-slate-900/55 shadow-lg shadow-slate-950/25">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-sm bg-emerald-300/15" />
          <div className="absolute inset-3 animate-pulse rounded-sm bg-emerald-300/35 shadow-lg shadow-emerald-950/50" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Arkini</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Preparing local world</h2>
          <p className="mt-2 text-sm text-slate-400">Opening OPFS SQLite and syncing game data.</p>
        </div>
      </div>
    </section>
  );
}
