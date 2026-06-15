import type { FC } from "react";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { GameItemView } from "./GameItemView";

export namespace ItemSummaryCard {
	export interface Props {
		item: ViewItem;
	}
}

export const ItemSummaryCard: FC<ItemSummaryCard.Props> = ({ item }) => (
	<div className="flex gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
		<div className="h-16 w-16 shrink-0 rounded-md bg-slate-900/70">
			<GameItemView
				item={item}
				variant="inventory"
			/>
		</div>
		<div className="min-w-0">
			<h2 className="font-semibold text-slate-50">{item.name}</h2>
			<p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
		</div>
	</div>
);
