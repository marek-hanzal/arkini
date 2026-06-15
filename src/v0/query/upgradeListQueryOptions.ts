import { queryOptions } from "@tanstack/react-query";
import { loadPlayBackend } from "~/v0/query/loadPlayBackend";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const upgradeListQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.upgrades,
		refetchInterval(query) {
			return query.state.data?.upgrades.some((upgrade) => upgrade.inProgress) ? 500 : false;
		},
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readUpgradeListView();
		},
	});
