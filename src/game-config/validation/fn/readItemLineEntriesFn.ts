import { match, P } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";

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
				type: TypeSchema.enum.Producer,
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
				type: TypeSchema.enum.Deposit,
			},
			({ lines }) =>
				(lines ?? []).map(
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
				type: P.union(
					TypeSchema.enum.Blueprint,
					TypeSchema.enum.Craft,
					TypeSchema.enum.Stash,
				),
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
					TypeSchema.enum.Simple,
					TypeSchema.enum.Space,
					TypeSchema.enum.Temporary,
					TypeSchema.enum.Inventory,
				),
			},
			() => [] as ItemLineEntrySchema.Type[],
		)
		.exhaustive();
