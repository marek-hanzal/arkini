import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { GameSchema } from "~/v1/schema/GameSchema";
import { RuntimeItemNotFoundError } from "~/v1/runtime/error/RuntimeItemNotFoundError";

export namespace resolveRuntimeItemFx {
	export interface Props {
		game: GameSchema.Type;
		itemId: IdSchema.Type;
	}

	export type Result = ItemSchema.Type;
}

/** Resolves one persisted item ID to its canonical loaded game object. */
export const resolveRuntimeItemFx = Effect.fn("resolveRuntimeItemFx")(function* ({
	game,
	itemId,
}: resolveRuntimeItemFx.Props) {
	const item = game.items[itemId];

	if (item === undefined) {
		return yield* Effect.fail(
			new RuntimeItemNotFoundError({
				itemId,
			}),
		);
	}

	return item satisfies resolveRuntimeItemFx.Result;
});
