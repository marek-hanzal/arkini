import type { FC } from "react";

export namespace ResourceRow {
	export interface Props {
		resource: {
			name: string;
			description: string;
			symbol: string;
			quantity: number;
		};
	}
}

export const ResourceRow: FC<ResourceRow.Props> = ({ resource }) => {
	return (
		<div className="flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/65 px-3 py-2">
			<span className="grid size-9 place-items-center rounded-md bg-slate-950 text-lg text-amber-200 ring-1 ring-slate-700">
				{resource.symbol}
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-bold text-slate-100">{resource.name}</p>
				<p className="truncate text-[0.68rem] text-slate-400">{resource.description}</p>
			</div>
			<span className="rounded-sm bg-slate-950/82 px-2 py-1 text-sm font-black tabular-nums text-slate-100">
				{resource.quantity}
			</span>
		</div>
	);
};
