import { Effect } from "effect";

import type { InputLocationSchema } from "~/v1/location/schema/InputLocationSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

export namespace readInputSlotLocationFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
	}
}

/** Reads the input slot occupied by one buffered or job-reserved material. */
export const readInputSlotLocationFx = Effect.fn("readInputSlotLocationFx")(function* ({
	item,
}: readInputSlotLocationFx.Props) {
	if (item.location.scope === "input") {
		return item.location;
	}
	if (item.location.scope === "job") {
		return item.location.returnLocation;
	}

	return undefined satisfies InputLocationSchema.Type | undefined;
});
