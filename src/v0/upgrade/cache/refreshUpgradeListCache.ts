import type { QueryClient } from "@tanstack/react-query";
import { upgradeListQueryOptions } from "~/v0/query/upgradeListQueryOptions";

export namespace refreshUpgradeListCache {
	export interface Props {
		queryClient: QueryClient;
	}
}

export const refreshUpgradeListCache = ({ queryClient }: refreshUpgradeListCache.Props) =>
	queryClient.fetchQuery(upgradeListQueryOptions());
