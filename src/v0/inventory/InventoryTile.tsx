import { useSuspenseQuery } from "@tanstack/react-query";
import { memo } from "react";
import { inventorySlotQueryOptions } from "~/v0/inventory/query/inventorySlotQueryOptions";
import { itemViewQueryOptions } from "~/v0/item/query/itemViewQueryOptions";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import type { ItemId } from "~/v0/manifest/manifestId";

export namespace InventoryTile {
	export interface Props {
		slotIndex: number;
	}
}

export const InventoryTile = memo(({ slotIndex }: InventoryTile.Props) => {
	const { data: slot } = useSuspenseQuery(
		inventorySlotQueryOptions({
			slotIndex,
		}),
	);
	const stack = slot.stack;
	const { data: item } = useSuspenseQuery(
		itemViewQueryOptions({
			itemId: (stack?.itemId ?? "item-seed") as ItemId,
		}),
	);

	if (!stack || !item) return null;

	return (
		<div
			data-ak-inventory-stack-id={stack.id}
			className="h-full w-full"
		>
			<GameItemView
				item={item}
				variant="inventory"
				quantity={stack.quantity}
			/>
		</div>
	);
});
