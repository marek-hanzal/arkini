import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

import type { ItemLineEntrySchema } from "../schema/ItemLineEntrySchema";

export namespace readItemLineEntriesFx {
	export interface Props {
		itemId: IdSchema.Type;
		item: ItemSchema.Type;
	}
}

/** Reads every product line owned by one canonical item with stable authoring paths. */
export const readItemLineEntriesFx = Effect.fn("readItemLineEntriesFx")(function* ({
	itemId,
	item,
}: readItemLineEntriesFx.Props) {
	return match(item)
		.with(
			{
				type: ItemEnumSchema.enum.Producer,
			},
			({ lines }) =>
				lines.map(
					(line, index) =>
						({
							line,
							path: [
								"items",
								itemId,
								"lines",
								index,
							],
						}) satisfies ItemLineEntrySchema.Type,
				),
		)
		.with(
			{
				type: P.union(ItemEnumSchema.enum.Blueprint, ItemEnumSchema.enum.Craft, ItemEnumSchema.enum.Stash),
			},
			({ line }) => [
				{
					line,
					path: [
						"items",
						itemId,
						"line",
					],
				} satisfies ItemLineEntrySchema.Type,
			],
		)
		.with(
			{
				type: P.union(ItemEnumSchema.enum.Deposit, ItemEnumSchema.enum.Simple, ItemEnumSchema.enum.Temporary, ItemEnumSchema.enum.Inventory),
			},
			() => [] as ItemLineEntrySchema.Type[],
		)
		.exhaustive();
});
