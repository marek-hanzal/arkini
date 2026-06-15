import type { QueryClient } from "@tanstack/react-query";
import { databaseStatusQueryOptions } from "~/v0/query/databaseStatusQueryOptions";

export namespace refreshDatabaseStatusCache {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const refreshDatabaseStatusCache = ({ queryClient }: refreshDatabaseStatusCache.Props) =>
	queryClient.fetchQuery(databaseStatusQueryOptions());
