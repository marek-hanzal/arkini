import type { FC } from "react";

import { useDevGamePack } from "../../../pack/hook/useDevGamePack";
import { PackDropzone } from "../../../pack/ui/PackDropzone";

export const FlowPage: FC = () => {
	const { config } = useDevGamePack();

	return (
		<main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
			<p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
				Flow graph
			</p>
			<h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
				The graph route is wired and waiting for its own quest.
			</h1>
			<p className="mt-4 max-w-3xl leading-7 text-slate-400">
				It already shares the validated pack state with the table. The next pass can focus
				on graph extraction, React Flow nodes, packed asset previews, and an ELK
				left-to-right layout instead of wasting time rebuilding upload plumbing like a
				particularly forgetful civilization.
			</p>
			{config ? (
				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
					<p className="text-sm text-slate-400">Ready source</p>
					<p className="mt-1 text-lg font-semibold text-white">
						{config.meta.title} · {Object.keys(config.items).length} items
					</p>
				</div>
			) : (
				<div className="mt-8">
					<PackDropzone />
				</div>
			)}
		</main>
	);
};
