import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
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
				type: "producer",
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
				type: P.union("blueprint", "craft", "stash"),
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
				type: P.union(
					"deposit",
					"simple",
					"temporary",
					"inventory",
					"memory",
					"cheat:speed",
					"nuke",
					"cheat:inventory",
				),
			},
			() => [] as ItemLineEntrySchema.Type[],
		)
		.exhaustive();
});
