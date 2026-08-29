import { Option } from "effect";

import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to an item occupying board space. */
export const isBoardRuntimeItemFn = (item: RuntimeItemSchema.Type) =>
	Option.liftPredicate(
		item,
		(candidate): candidate is BoardRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Board,
	);
