import { Effect } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";

export namespace resolveItemFx {
	export interface Props {
		itemUid: IdSchema.Type;
	}
}

/**
 * Resolves one item UID to its canonical object in the loaded game context.
 */
export const resolveItemFx = Effect.fn("resolveItemFx")(function* ({
	itemUid,
}: resolveItemFx.Props) {
	const config = yield* GameConfigFx;
	const item = config.items[itemUid];

	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				itemUid,
			}),
		);
	}

	return item satisfies ItemSchema.Type;
});
