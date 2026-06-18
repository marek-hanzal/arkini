import type { FC } from "react";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { GameItemView } from "./GameItemView";

export namespace ItemSummaryCard {
	export interface Props {
		item: ViewItem;
		storeDisabled?: boolean;
		onStore?(): void;
	}
}

export const ItemSummaryCard: FC<ItemSummaryCard.Props> = ({
	item,
	storeDisabled = false,
	onStore,
}) => (
	<div className="flex gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
		<div className="h-16 w-16 shrink-0 rounded-md bg-slate-900/70">
			<GameItemView
				item={item}
				variant="inventory"
			/>
		</div>
		<div className="min-w-0 flex-1">
			<div className="flex items-start justify-between gap-3">
				<h2 className="min-w-0 font-semibold text-slate-50">{item.name}</h2>
				{onStore ? (
					<button
						type="button"
						disabled={storeDisabled}
						onClick={onStore}
						className="shrink-0 rounded-sm border border-slate-600/70 px-2 py-1 text-xs font-bold text-slate-300 transition hover:border-slate-400/80 hover:text-slate-100 disabled:opacity-35"
					>
						Store
					</button>
				) : null}
			</div>
			<p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
		</div>
	</div>
);
