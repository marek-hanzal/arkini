import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

export namespace resolveItemFx {
	export interface Props {
		itemId: IdSchema.Type;
	}
}

/**
 * Resolves one item ID to its canonical object in the loaded game context.
 */
export const resolveItemFx = Effect.fn("resolveItemFx")(function* ({
	itemId,
}: resolveItemFx.Props) {
	const config = yield* GameConfigFx;
	const item = config.items[itemId];

	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				itemId,
			}),
		);
	}

	return item satisfies ItemSchema.Type;
});
