import { match } from "ts-pattern";

import { readItemRemainingChargesFn } from "~/production-action/fn/readItemRemainingChargesFn";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Projects the one count shown by a tile badge from canonical runtime truth. */
export const readTileActorBadgeCountFn = (item: RuntimeItemSchema.Type) =>
	match(item)
		.with(
			{
				item: {
					type: TypeSchema.enum.Deposit,
				},
			},
			(deposit) => readItemRemainingChargesFn(deposit),
		)
		.otherwise(({ quantity }) => (quantity > 1 ? quantity : undefined));
