import type { QueryClient } from "@tanstack/react-query";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { inventoryQueryKeys } from "~/v0/inventory/query/inventoryQueryKeys";

export namespace patchInventoryViewCache {
	export interface Props {
		queryClient: QueryClient;
		patch(inventory: InventoryView): InventoryView;
	}
}

export const patchInventoryViewCache = ({ queryClient, patch }: patchInventoryViewCache.Props) => {
	let previous: InventoryView | undefined;

	queryClient.setQueryData<InventoryView>(inventoryQueryKeys.view, (inventory) => {
		if (!inventory) return inventory;
		previous = inventory;
		return patch(inventory);
	});

	return previous;
};
