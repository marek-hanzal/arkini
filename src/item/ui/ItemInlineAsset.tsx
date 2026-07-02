import type { FC } from "react";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import { cn } from "~/ui/cn";
import { GameItemView } from "./GameItemView";

export namespace ItemInlineAsset {
	export interface Props {
		item?: ViewItem;
		className?: string;
	}
}

export const ItemInlineAsset: FC<ItemInlineAsset.Props> = ({ item, className }) => (
	<div
		aria-hidden="true"
		className={cn("shrink-0 rounded-sm bg-ak-surface-soft p-1", "h-10 w-10", className)}
	>
		{item ? (
			<GameItemView
				item={item}
				variant="inventory"
			/>
		) : null}
	</div>
);
