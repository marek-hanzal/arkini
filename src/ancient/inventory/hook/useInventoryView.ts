import { useSuspenseQuery } from "@tanstack/react-query";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { loadPlayBackend } from "~/play/hook/loadPlayBackend";
import { playQueryKeys } from "~/play/hook/playQueryKeys";

export function useInventoryView(): InventoryView {
	return useSuspenseQuery({
		queryKey: playQueryKeys.inventory,
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readInventoryView();
		},
	}).data;
}
