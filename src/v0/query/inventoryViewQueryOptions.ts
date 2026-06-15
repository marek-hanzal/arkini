import { queryOptions } from "@tanstack/react-query";
import { loadPlayBackend } from "~/v0/query/loadPlayBackend";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const inventoryViewQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.inventory,
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readInventoryView();
		},
	});
