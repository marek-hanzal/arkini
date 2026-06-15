import { queryOptions } from "@tanstack/react-query";
import { loadV0PlayBackend } from "~/v0/query/loadPlayBackend";
import { v0PlayQueryKeys } from "~/v0/query/playQueryKeys";

export const upgradeListQueryOptions = () =>
	queryOptions({
		queryKey: v0PlayQueryKeys.upgrades,
		refetchInterval(query) {
			return query.state.data?.upgrades.some((upgrade) => upgrade.inProgress) ? 500 : false;
		},
		async queryFn() {
			const db = await loadV0PlayBackend();
			return db.readUpgradeListView();
		},
	});
