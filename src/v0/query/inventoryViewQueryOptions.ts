import { queryOptions } from "@tanstack/react-query";
import { loadV0PlayBackend } from "~/v0/query/loadPlayBackend";
import { v0PlayQueryKeys } from "~/v0/query/playQueryKeys";

export const inventoryViewQueryOptions = () =>
	queryOptions({
		queryKey: v0PlayQueryKeys.inventory,
		async queryFn() {
			const db = await loadV0PlayBackend();
			return db.readInventoryView();
		},
	});
