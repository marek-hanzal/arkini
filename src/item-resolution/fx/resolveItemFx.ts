import { Effect } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";

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
