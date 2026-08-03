import { Effect } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

export namespace selectItemsFx {
	export interface Props {
		items: ReadonlyArray<ItemSchema.Type>;
		selector: SelectorSchema.Type;
	}
}

/** Tests one canonical item against the exhaustive selector grammar without allocating an Effect. */
export const matchesItemSelector = ({
	item,
	selector,
}: {
	readonly item: ItemSchema.Type;
	readonly selector: SelectorSchema.Type;
}) => selector.itemId === item.id;

/** Selects canonical items through the one exhaustive selector grammar. */
export const selectItemsFx = Effect.fn("selectItemsFx")(function* ({
	items,
	selector,
}: selectItemsFx.Props) {
	return items.filter((item) =>
		matchesItemSelector({
			item,
			selector,
		}),
	);
});
