import { queryOptions } from "@tanstack/react-query";
import { loadPlayBackend } from "~/v0/query/loadPlayBackend";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const itemCatalogQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.items,
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readItemCatalogView();
		},
		staleTime: Infinity,
	});
