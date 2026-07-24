import { Effect } from "effect";

import type { InputSchema } from "~/engine/input/schema/InputSchema";

/** Reads the stable aggregation identity of one optional Item Detail charge cost. */
export const readItemDetailChargeKeyFx = Effect.fn("readItemDetailChargeKeyFx")(function* (
	charges: InputSchema.Type["charges"],
) {
	return charges === undefined ? "none" : `${charges.from}:${charges.cost}`;
});
