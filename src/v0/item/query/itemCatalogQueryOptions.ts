import { queryOptions } from "@tanstack/react-query";
import { readItemCatalogFx } from "~/play/fx/readItemCatalogFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { itemQueryKeys } from "~/v0/item/query/itemQueryKeys";

export const itemCatalogQueryOptions = () =>
	queryOptions({
		queryKey: itemQueryKeys.catalog,
		queryFn() {
			return runGameFx({
				effect: readItemCatalogFx(),
			});
		},
		staleTime: Infinity,
	});
