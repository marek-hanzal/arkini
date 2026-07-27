import { Effect, Option } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to a board, inventory, or toolbar item. */
export const isGridRuntimeItemFx = Effect.fnUntraced(function* (item: RuntimeItemSchema.Type) {
	return Option.liftPredicate(
		item,
		(candidate): candidate is GridRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Board ||
			candidate.location.scope === LocationScopeEnumSchema.enum.Inventory ||
			candidate.location.scope === LocationScopeEnumSchema.enum.Toolbar,
	);
});
