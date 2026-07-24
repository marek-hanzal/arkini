import { Effect, Option } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to an item occupying board space. */
export const isBoardRuntimeItemFx = Effect.fn("isBoardRuntimeItemFx")(function* (
	item: RuntimeItemSchema.Type,
) {
	return Option.liftPredicate(
		item,
		(candidate): candidate is BoardRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Board,
	);
});
