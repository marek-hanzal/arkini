import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

interface ReadRuntimeItemByIdProps {
	itemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}

/**
 * Reads one item from an explicit immutable runtime snapshot.
 */
export const readRuntimeItemByIdFx = Effect.fn("readRuntimeItemByIdFx")(function* ({
	itemId,
	runtime,
}: ReadRuntimeItemByIdProps) {
	const item = pipe(
		runtime.items,
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

	return item satisfies RuntimeItemSchema.Type;
});
