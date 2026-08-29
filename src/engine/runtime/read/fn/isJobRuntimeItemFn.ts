import { Option } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { JobRuntimeItemSchema } from "~/engine/runtime/schema/JobRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Narrows one live runtime item to an item currently committed to an active job. */
export const isJobRuntimeItemFn = (item: RuntimeItemSchema.Type) =>
	Option.liftPredicate(
		item,
		(candidate): candidate is JobRuntimeItemSchema.Type =>
			candidate.location.scope === LocationScopeEnumSchema.enum.Job,
	);
