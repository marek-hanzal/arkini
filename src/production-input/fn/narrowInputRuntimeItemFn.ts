import { Option } from "effect";

import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to a line-owned input material. */
export const narrowInputRuntimeItemFn = (item: RuntimeItemSchema.Type) =>
	Option.liftPredicate(
		item,
		(candidate): candidate is InputRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Input,
	);
