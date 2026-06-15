import { queryOptions } from "@tanstack/react-query";
import { readViewFx } from "~/inventory/fx/readViewFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { inventoryQueryKeys } from "~/v0/inventory/query/inventoryQueryKeys";

export const inventoryViewQueryOptions = () =>
	queryOptions({
		queryKey: inventoryQueryKeys.view,
		queryFn() {
			return runGameFx({
				effect: readViewFx(),
			});
		},
	});
