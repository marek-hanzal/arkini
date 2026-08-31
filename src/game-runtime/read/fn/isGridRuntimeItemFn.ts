import { Option } from "effect";

import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to a board, inventory, or toolbar item. */
export const isGridRuntimeItemFn = (item: RuntimeItemSchema.Type) =>
	Option.liftPredicate(
		item,
		(candidate): candidate is GridRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Board ||
			candidate.location.scope === LocationScopeEnumSchema.enum.Inventory ||
			candidate.location.scope === LocationScopeEnumSchema.enum.Toolbar,
	);
