import { queryOptions } from "@tanstack/react-query";
import { readStatusFx } from "~/play/fx/readStatusFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const databaseStatusQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.databaseStatus,
		queryFn() {
			return runGameFx({
				effect: readStatusFx(),
			});
		},
	});
