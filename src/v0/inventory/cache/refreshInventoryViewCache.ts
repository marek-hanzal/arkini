import type { QueryClient } from "@tanstack/react-query";
import { inventoryViewQueryOptions } from "~/v0/inventory/query/inventoryViewQueryOptions";

export namespace refreshInventoryViewCache {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const refreshInventoryViewCache = ({ queryClient }: refreshInventoryViewCache.Props) =>
	queryClient.fetchQuery(inventoryViewQueryOptions());
