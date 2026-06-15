import { queryOptions } from "@tanstack/react-query";
import { readInventoryViewFx } from "~/v0/inventory/fx/readInventoryViewFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { inventoryQueryKeys } from "~/v0/inventory/query/inventoryQueryKeys";

export const inventoryViewQueryOptions = () =>
	queryOptions({
		queryKey: inventoryQueryKeys.view,
		queryFn() {
			return runGameFx({
				effect: readInventoryViewFx(),
			});
		},
	});
