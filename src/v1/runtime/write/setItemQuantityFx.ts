import { Array, Effect, Option, pipe, SynchronizedRef } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

export namespace setItemQuantityFx {
	export interface Props {
		itemId: IdSchema.Type;
		quantity: PositiveIntegerSchema.Type;
	}
}

/**
 * Atomically replaces one live item's stack quantity.
 */
export const setItemQuantityFx = Effect.fn("setItemQuantityFx")(function* ({
	itemId,
	quantity,
}: setItemQuantityFx.Props) {
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

		const updatedItem = {
			...item,
			quantity,
		} satisfies RuntimeItemSchema.Type;

		return Effect.succeed([
			updatedItem,
			{
				items: runtime.items.map((candidate) => {
					return candidate.id === itemId ? updatedItem : candidate;
				}),
			},
		] as const);
	});
});
