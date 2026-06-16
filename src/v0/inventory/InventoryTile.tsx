import { useSuspenseQuery } from "@tanstack/react-query";
import { memo } from "react";
import { itemViewQueryOptions } from "~/v0/item/query/itemViewQueryOptions";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import type { ItemId } from "~/v0/manifest/manifestId";

export namespace InventoryTile {
	export interface Props {
		stackId: string;
		itemId: ItemId;
		quantity: number;
	}
}

export const InventoryTile = memo(({ stackId, itemId, quantity }: InventoryTile.Props) => {
	const { data: item } = useSuspenseQuery(
		itemViewQueryOptions({
			itemId,
		}),
	);

	if (!item) return null;

	return (
		<div
			data-ak-inventory-stack-id={stackId}
			className="h-full w-full"
		>
			<GameItemView
				item={item}
				variant="inventory"
				quantity={quantity}
			/>
		</div>
	);
});
