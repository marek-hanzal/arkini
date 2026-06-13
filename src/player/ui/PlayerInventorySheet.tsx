import { SheetHeader } from "~/shared/ui/SheetHeader";
import { usePlayPlayerInventory } from "~/play/hook/usePlayPlayerInventory";

export namespace PlayerInventorySheet {
	export interface Props {
		onClose(): void;
	}
}

export function PlayerInventorySheet({ onClose }: PlayerInventorySheet.Props) {
	const playerInventory = usePlayPlayerInventory().data;

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Player"
				description="Resources and currencies"
				onClose={onClose}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<div className="ak-game-width mx-auto grid gap-2">
					{playerInventory?.resources.map((resource) => (
						<ResourceRow
							key={resource.id}
							resource={resource}
						/>
					)) ?? null}
				</div>
			</div>
		</div>
	);
}

namespace ResourceRow {
	export interface Props {
		resource: {
			name: string;
			description: string;
			symbol: string;
			quantity: number;
		};
	}
}

function ResourceRow({ resource }: ResourceRow.Props) {
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
}
