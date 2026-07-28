import { Effect, Option } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { DeliveryRuntimeItemSchema } from "~/engine/runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to a canonical outbound or returning delivery. */
export const isDeliveryRuntimeItemFx = Effect.fnUntraced(function* (item: RuntimeItemSchema.Type) {
	return Option.liftPredicate(
		item,
		(candidate): candidate is DeliveryRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Delivery,
	);
});
