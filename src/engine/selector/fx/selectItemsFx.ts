import { Effect } from "effect";
import { match } from "ts-pattern";

import { SelectorEnumSchema } from "~/engine/selector/schema/SelectorEnumSchema";
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
}) =>
	match(selector)
		.with(
			{
				type: SelectorEnumSchema.enum.Item,
			},
			({ itemId }) => itemId === item.id,
		)
		.with(
			{
				type: SelectorEnumSchema.enum.Tag,
			},
			({ tag }) => item.tags.includes(tag),
		)
		.exhaustive();

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
