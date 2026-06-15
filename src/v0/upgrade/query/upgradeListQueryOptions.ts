import { queryOptions } from "@tanstack/react-query";
import { readViewFx } from "~/upgrade/fx/readViewFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { upgradeQueryKeys } from "~/v0/upgrade/query/upgradeQueryKeys";

export const upgradeListQueryOptions = () =>
	queryOptions({
		queryKey: upgradeQueryKeys.list,
		refetchInterval(query) {
			return query.state.data?.upgrades.some((upgrade) => upgrade.inProgress) ? 500 : false;
		},
		queryFn() {
			return runGameFx({
				effect: readViewFx(),
			});
		},
	});
