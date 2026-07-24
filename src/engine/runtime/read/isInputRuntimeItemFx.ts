import { Effect, Option } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to a line-owned input material. */
export const isInputRuntimeItemFx = Effect.fn("isInputRuntimeItemFx")(function* (
	item: RuntimeItemSchema.Type,
) {
	return Option.liftPredicate(
		item,
		(candidate): candidate is InputRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Input,
	);
});
