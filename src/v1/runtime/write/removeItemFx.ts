import { Array, Effect, Option, pipe, SynchronizedRef } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { assertRuntimeFx } from "~/v1/runtime/check/assertRuntimeFx";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
		return Effect.gen(function* () {
			const item = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === itemId),
				Option.getOrUndefined,
			);
			if (item === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId,
					}),
				);
			}

			const nextRuntime = {
				items: runtime.items.filter((candidate) => candidate.id !== itemId),
			} satisfies RuntimeSchema.Type;
			yield* assertRuntimeFx({
				runtime: nextRuntime,
			});

			return [
				item,
				nextRuntime,
			] as const;
		});
	});
});
