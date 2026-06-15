import { queryOptions } from "@tanstack/react-query";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import { inventoryQueryKeys } from "~/v0/inventory/query/inventoryQueryKeys";
import { inventoryViewQueryOptions } from "~/v0/inventory/query/inventoryViewQueryOptions";

export namespace inventorySlotQueryOptions {
	export interface Props {
		slotIndex: number;
	}
}

export const inventorySlotQueryOptions = ({ slotIndex }: inventorySlotQueryOptions.Props) =>
	queryOptions({
		...inventoryViewQueryOptions(),
		queryKey: inventoryQueryKeys.view,
		select(inventory): InventorySlot {
			return (
				inventory.bySlotIndex[String(slotIndex)] ?? {
					slotIndex,
				}
			);
		},
	});
