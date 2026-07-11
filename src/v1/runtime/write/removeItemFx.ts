import { Array, Effect, Option, pipe, SynchronizedRef } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";

export namespace removeItemFx {
	export interface Props {
		itemId: IdSchema.Type;
	}
}

/**
 * Atomically removes one live item by its stable identity.
 */
export const removeItemFx = Effect.fn("removeItemFx")(function* ({ itemId }: removeItemFx.Props) {
	const store = yield* RuntimeStoreFx;

	return yield* SynchronizedRef.modifyEffect(store, (runtime) => {
		const item = pipe(
			runtime.items,
			Array.findFirst((candidate) => candidate.id === itemId),
			Option.getOrUndefined,
		);
		if (item === undefined) {
			return Effect.fail(
				new ItemNotFoundError({
					itemId,
				}),
			);
		}

		return Effect.succeed([
			item,
			{
				items: runtime.items.filter((candidate) => candidate.id !== itemId),
			},
		] as const);
	});
});
