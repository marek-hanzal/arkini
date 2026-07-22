import { Effect } from "effect";

import type { InputLocationSchema } from "~/engine/location/schema/InputLocationSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readInputSlotLocationFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
	}
}

/** Reads the concrete input slot occupied by one buffered material. */
export const readInputSlotLocationFx = Effect.fn("readInputSlotLocationFx")(function* ({
	item,
}: readInputSlotLocationFx.Props) {
	if (item.location.scope === LocationScopeEnumSchema.enum.Input) {
		return item.location;
	}
	return undefined satisfies InputLocationSchema.Type | undefined;
});
