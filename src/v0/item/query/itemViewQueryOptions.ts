import { queryOptions } from "@tanstack/react-query";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import { itemCatalogQueryOptions } from "~/v0/item/query/itemCatalogQueryOptions";
import { itemQueryKeys } from "~/v0/item/query/itemQueryKeys";

export namespace itemViewQueryOptions {
	export interface Props {
		itemId: ItemId;
	}
}

export const itemViewQueryOptions = ({ itemId }: itemViewQueryOptions.Props) =>
	queryOptions({
		...itemCatalogQueryOptions(),
		queryKey: itemQueryKeys.catalog,
		select(catalog): ViewItem | null {
			return catalog[itemId] ?? null;
		},
	});
