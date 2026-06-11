import { AssetStrip } from "~/components/AssetStrip";
import { BoardPreview } from "~/components/BoardPreview";
import { DbStatusCard } from "~/components/DbStatusCard";

export function HomeScreen() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
      <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
          Arkini phase 1
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Client-only merge-game skeleton
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Static Vite SPA, TanStack Router, TanStack Query, OPFS SQLite, Kysely
              migrations, and one game-data manifest that defines every static rule. No
              server runtime, no SSR séance, no gameplay yet.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            <p className="font-medium text-slate-200">Current design rule</p>
            <p className="mt-2">
              The board is where merging and producer drops happen. Inventory is storage.
              Crafting consumes inventory materials and a blueprint, then places a 1×1 item.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <BoardPreview />
        <div className="flex flex-col gap-8">
          <DbStatusCard />
          <AssetStrip />
        </div>
      </div>
    </main>
  );
}
