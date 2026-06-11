import { assetDefinitions } from "@arkini/assets";

export function AssetStrip() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">
        Generated SVG assets
      </p>
      <h2 className="mt-2 text-xl font-semibold text-white">First tiny icons</h2>
      <div className="mt-5 grid grid-cols-5 gap-3">
        {assetDefinitions.map((asset) => (
          <figure
            key={asset.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-center"
          >
            <img
              src={asset.src}
              alt={asset.label}
              className="mx-auto h-12 w-12"
            />
            <figcaption className="mt-2 truncate text-xs text-slate-400">{asset.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
