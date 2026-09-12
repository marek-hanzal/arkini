import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { readDraftFn } from "~/item-authoring/fn/readDraftFn";
import { searchFn } from "~/item-authoring/fn/searchFn";

export namespace filterFn {
	export interface Props {
		readonly draft: boolean;
		readonly itemType?: TypeSchema.Type;
		readonly query: string;
	}
}

/** Composes the Editor item collection's draft, type, and fuzzy-search filters. */
export const filterFn = (
	items: ReadonlyArray<ItemSchema.Type>,
	{ draft, itemType, query }: filterFn.Props,
): ReadonlyArray<ItemSchema.Type> =>
	searchFn(
		items.filter(
			(item) =>
				(!draft || readDraftFn(item)) && (itemType === undefined || item.type === itemType),
		),
		query,
	);
