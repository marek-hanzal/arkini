import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { getItemsFx } from "./getItemsFx";

export namespace getItemFx {
	export interface Props {
		itemId: IdSchema.Type;
	}
}

/**
 * Reads one live item by its stable runtime identity.
 */
export const getItemFx = Effect.fn("getItemFx")(function* ({ itemId }: getItemFx.Props) {
	const items = yield* getItemsFx();
	const item = pipe(
		items,
		Array.findFirst((item) => item.id === itemId),
		Option.getOrUndefined,
	);

	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				itemId,
			}),
		);
	}

	return item;
});
