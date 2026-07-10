import type { FC } from "react";
import { useMemo, useState } from "react";

import { useDevGamePack } from "../../../pack/hook/useDevGamePack";
import { PackDropzone } from "../../../pack/ui/PackDropzone";
import { PackSummary } from "../../../pack/ui/PackSummary";
import { useFilteredItems } from "../hook/useFilteredItems";
import { ItemTable } from "./ItemTable";

export const ItemTablePage: FC = () => {
	const { config } = useDevGamePack();
	const [query, setQuery] = useState("");
	const items = useMemo(
		() => (config ? Object.values(config.items) : []),
		[
			config,
		],
	);
	const filteredItems = useFilteredItems(items, query);

	if (!config) {
		return (
			<main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
				<p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
					Item table
				</p>
				<h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
					Load a game pack first.
				</h1>
				<p className="mt-4 max-w-2xl leading-7 text-slate-400">
					The table reads the decoded v1 config. Guessing item rows without one would be
					innovative only in the accounting sense.
				</p>
				<div className="mt-8">
					<PackDropzone />
				</div>
			</main>
		);
	}

	return (
		<main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
			<div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
				<div>
					<p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
						Item table
					</p>
					<h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
						{config.meta.title} catalog
					</h1>
					<p className="mt-3 max-w-3xl leading-7 text-slate-400">
						Rows use the inferred v1 ItemSchema directly. Expand any item to inspect
						type-specific fields, lines, inputs, rolls, rules, merges, and packed
						assets.
					</p>
				</div>
				<label className="block w-full xl:max-w-xl">
					<span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
						Fuse.js search
					</span>
					<input
						type="search"
						value={query}
						placeholder="Search title, ID, description, type, category, tags, lines…"
						className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
						onChange={(event) => setQuery(event.currentTarget.value)}
					/>
				</label>
			</div>

			<div className="mt-6">
				<PackSummary />
			</div>
			<div className="mt-6">
				<ItemTable
					items={filteredItems}
					categories={config.categories}
				/>
			</div>
		</main>
	);
};
