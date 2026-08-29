import { Option } from "effect";

import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { ReservedRuntimeItemSchema } from "~/engine/runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Narrows one runtime item to a live item temporarily retained by a job. */
export const isReservedRuntimeItemFn = (item: RuntimeItemSchema.Type) =>
	Option.liftPredicate(
		item,
		(candidate): candidate is ReservedRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Reserved,
	);
