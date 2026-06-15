import { queryOptions } from "@tanstack/react-query";
import { readItemCatalogFx } from "~/play/fx/readItemCatalogFx";
import { runGameFx } from "~/v0/fx/runGameFx";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export const itemCatalogQueryOptions = () =>
	queryOptions({
		queryKey: playQueryKeys.items,
		queryFn() {
			return runGameFx({
				effect: readItemCatalogFx(),
			});
		},
		staleTime: Infinity,
	});
