import { useSuspenseQuery } from "@tanstack/react-query";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import { loadPlayBackend } from "./loadPlayBackend";
import { playQueryKeys } from "./playQueryKeys";

export function usePlayItems(): ItemCatalogView {
	return useSuspenseQuery({
		queryKey: playQueryKeys.items,
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readItemCatalogView();
		},
		staleTime: Infinity,
	}).data;
}
