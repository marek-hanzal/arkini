import { queryOptions } from "@tanstack/react-query";
import { readViewFx } from "~/upgrade/fx/readViewFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const upgradeListQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.upgrades,
		refetchInterval(query) {
			return query.state.data?.upgrades.some((upgrade) => upgrade.inProgress) ? 500 : false;
		},
		queryFn() {
			return runGameFx({
				effect: readViewFx(),
			});
		},
	});
