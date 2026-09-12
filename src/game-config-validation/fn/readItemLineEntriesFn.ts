import { match, P } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

import type { ItemLineEntrySchema } from "../schema/ItemLineEntrySchema";

export namespace readItemLineEntriesFn {
	export interface Props {
		itemId: IdSchema.Type;
		item: ItemSchema.Type;
	}
}

/** Reads every product line owned by one canonical item with stable authoring paths. */
export const readItemLineEntriesFn = ({ itemId, item }: readItemLineEntriesFn.Props) =>
	match(item)
		.with(
			{
				type: P.union(TypeSchema.enum.Common, TypeSchema.enum.Clock),
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
				type: P.union(TypeSchema.enum.Temporary, TypeSchema.enum.Inventory),
			},
			() => [] as ItemLineEntrySchema.Type[],
		)
		.exhaustive();
