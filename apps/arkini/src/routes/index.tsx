import { createFileRoute } from "@tanstack/react-router";
import { AssetStrip } from "~/components/AssetStrip";
import { BoardPreview } from "~/components/BoardPreview";
import { DbStatusCard } from "~/components/DbStatusCard";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
      <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/50">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
          Arkini phase 1
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Offline merge-game skeleton
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              TanStack Start shell, TanStack Query provider, OPFS SQLite database, Kysely
              migrations, generated SVG asset registry, and a board placeholder. Gameplay is
              deliberately missing, because even chaos deserves staging.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            <p className="font-medium text-slate-200">Next obvious step</p>
            <p className="mt-2">
              Add item spawning, drag state, merge resolver, and save-game hydration once the
              boring foundation stops being suspicious.
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
