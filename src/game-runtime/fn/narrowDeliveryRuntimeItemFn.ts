import { Option } from "effect";

import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { DeliveryRuntimeItemSchema } from "~/game-runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to a canonical outbound or returning delivery. */
export const narrowDeliveryRuntimeItemFn = (item: RuntimeItemSchema.Type) =>
	Option.liftPredicate(
		item,
		(candidate): candidate is DeliveryRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Delivery,
	);
