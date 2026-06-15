import { queryOptions } from "@tanstack/react-query";
import { readViewFx } from "~/inventory/fx/readViewFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const inventoryViewQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.inventory,
		queryFn() {
			return runGameFx({
				effect: readViewFx(),
			});
		},
	});
