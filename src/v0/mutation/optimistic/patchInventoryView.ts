import type { QueryClient } from "@tanstack/react-query";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export namespace patchInventoryView {
	export interface Props {
		queryClient: QueryClient;
		patch(inventory: InventoryView): InventoryView;
	}
}

export const patchInventoryView = ({ queryClient, patch }: patchInventoryView.Props) => {
	let previous: InventoryView | undefined;

	queryClient.setQueryData<InventoryView>(playQueryKeys.inventory, (inventory) => {
		if (!inventory) return inventory;
		previous = inventory;
		return patch(inventory);
	});

	return previous;
};
