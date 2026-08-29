import { Effect, Option } from "effect";

import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Reads one grid item from an optional runtime without leaking Option to cue compilers. */
export const readGridRuntimeItemFx = Effect.fn("readGridRuntimeItemFx")(function* ({
	itemId,
	runtime,
}: {
	readonly itemId: string;
	readonly runtime: RuntimeSchema.Type | null;
}) {
	if (runtime === null) return null;
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return null;
	return Option.getOrNull(isGridRuntimeItemFn(item));
});
