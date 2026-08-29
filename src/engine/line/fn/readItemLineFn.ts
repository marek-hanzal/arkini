import { match, P } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";

export namespace readItemLineFn {
	export interface Props {
		readonly item: ItemSchema.Type;
		readonly lineId: IdSchema.Type;
	}
}

/** Reads one configured product line owned by a canonical item. */
export const readItemLineFn = ({ item, lineId }: readItemLineFn.Props) =>
	match(item)
		.with(
			{
				type: TypeSchema.enum.Producer,
			},
			({ lines }) => lines.find((line) => line.id === lineId),
		)
		.with(
			{
				type: TypeSchema.enum.Deposit,
			},
			({ lines }) => lines?.find((line) => line.id === lineId),
		)
		.with(
			{
				type: P.union(
					TypeSchema.enum.Blueprint,
					TypeSchema.enum.Craft,
					TypeSchema.enum.Stash,
				),
			},
			({ line }) => (line.id === lineId ? line : undefined),
		)
		.otherwise(() => undefined) satisfies LineSchema.Type | undefined;
