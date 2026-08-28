import { Effect } from "effect";
import { match } from "ts-pattern";

import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Projects the one count shown by a tile badge from canonical runtime truth. */
export const readTileActorBadgeCountFx = Effect.fn("readTileActorBadgeCountFx")(function* (
	item: RuntimeItemSchema.Type,
) {
	return yield* match(item)
		.with(
			{
				item: {
					type: TypeSchema.enum.Deposit,
				},
			},
			(deposit) => readItemRemainingChargesFx(deposit),
		)
		.otherwise(({ quantity }) => Effect.succeed(quantity > 1 ? quantity : undefined));
});
