import { boardConfig } from "@arkini/game";

export function BoardPreview() {
  const cells = Array.from({ length: boardConfig.width * boardConfig.height }, (_, index) => index);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
            Board shell
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {boardConfig.width} × {boardConfig.height} placeholder
          </h2>
        </div>
        <p className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400">
          no gameplay
        </p>
      </div>

      <div
        className="mt-5 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${boardConfig.width}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => (
          <div
            key={cell}
            className="aspect-square rounded-2xl border border-slate-800 bg-slate-950/80 shadow-inner shadow-black/30"
          />
        ))}
      </div>
    </section>
  );
}
