import { Array, Effect, Option, pipe, SynchronizedRef } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import type { SwapItemsResultSchema } from "~/v1/runtime/schema/command/SwapItemsResultSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

export namespace swapItemsFx {
	export interface Props {
		firstItemId: IdSchema.Type;
		secondItemId: IdSchema.Type;
	}
}

/**
 * Atomically exchanges the locations owned by two live items.
 */
export const swapItemsFx = Effect.fn("swapItemsFx")(function* ({
	firstItemId,
	secondItemId,
}: swapItemsFx.Props) {
	const store = yield* RuntimeStoreFx;

	return yield* SynchronizedRef.modifyEffect(store, (runtime) => {
		const findItem = (itemId: IdSchema.Type) => {
			return pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === itemId),
				Option.getOrUndefined,
			);
		};
		const first = findItem(firstItemId);
		if (first === undefined) {
			return Effect.fail(
				new ItemNotFoundError({
					itemId: firstItemId,
				}),
			);
		}
		const second = findItem(secondItemId);
		if (second === undefined) {
			return Effect.fail(
				new ItemNotFoundError({
					itemId: secondItemId,
				}),
			);
		}

		const swappedFirst = {
			...first,
			location: second.location,
		} satisfies RuntimeItemSchema.Type;
		const swappedSecond = {
			...second,
			location: first.location,
		} satisfies RuntimeItemSchema.Type;
		const result = {
			first: swappedFirst,
			second: swappedSecond,
		} satisfies SwapItemsResultSchema.Type;

		return Effect.succeed([
			result,
			{
				items: runtime.items.map((candidate) => {
					if (candidate.id === firstItemId) {
						return swappedFirst;
					}
					if (candidate.id === secondItemId) {
						return swappedSecond;
					}

					return candidate;
				}),
			},
		] as const);
	});
});
