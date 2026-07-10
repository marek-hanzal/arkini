import { Link } from "@tanstack/react-router";
import type { FC } from "react";

import { useDevGamePack } from "../../pack/hook/useDevGamePack";
import { PackDropzone } from "../../pack/ui/PackDropzone";
import { PackSummary } from "../../pack/ui/PackSummary";

export const DevHomePage: FC = () => {
	const { config } = useDevGamePack();

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
			<section className="max-w-3xl">
				<p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">
					Client-only game inspector
				</p>
				<h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
					Inspect the actual Arkini pack, not whatever someone remembers it contains.
				</h1>
				<p className="mt-5 text-lg leading-8 text-slate-400">
					Load a compiled <span className="font-mono text-slate-300">.arkpack</span>. The
					inspector validates it with the v1 schemas and exposes the same decoded config
					to the item table and the upcoming game-flow graph.
				</p>
			</section>

			<div className="mt-10">
				<PackDropzone />
			</div>
			<div className="mt-5">
				<PackSummary />
			</div>

			<section className="mt-10 grid gap-4 md:grid-cols-2">
				<Link
					to="/dev/table"
					className={`group rounded-2xl border p-6 transition ${
						config
							? "border-slate-700 bg-slate-900/60 hover:-translate-y-0.5 hover:border-violet-500/70 hover:bg-slate-900"
							: "border-slate-800 bg-slate-900/30"
					}`}
				>
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
								Available now
							</p>
							<h2 className="mt-2 text-xl font-semibold text-white">Item table</h2>
							<p className="mt-2 leading-7 text-slate-400">
								Fuzzy-search every item, sort the catalog, and expand rows into
								schema-aware details.
							</p>
						</div>
						<span className="text-2xl text-slate-600 transition group-hover:translate-x-1 group-hover:text-violet-300">
							→
						</span>
					</div>
				</Link>

				<Link
					to="/dev/flow"
					className="group rounded-2xl border border-slate-800 bg-slate-900/30 p-6 transition hover:border-slate-700"
				>
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
								Next quest
							</p>
							<h2 className="mt-2 text-xl font-semibold text-white">Game flow</h2>
							<p className="mt-2 leading-7 text-slate-400">
								A left-to-right graph of item production, branches, details, and
								packed assets.
							</p>
						</div>
						<span className="text-2xl text-slate-700 transition group-hover:text-slate-400">
							↗
						</span>
					</div>
				</Link>
			</section>
		</main>
	);
};
