import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { GameFx } from "~/v1/game/context/GameFx";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";

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
	const game = yield* GameFx;
	const item = game.items[itemId];

	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				itemId,
			}),
		);
	}

	return item satisfies ItemSchema.Type;
});
