import type { InputSchema } from "~/production-input/schema/InputSchema";

/** Reads the stable aggregation identity of one optional Item Detail charge cost. */
export const readItemDetailChargeKeyFn = (charges: InputSchema.Type["charges"]) =>
	charges === undefined ? "none" : `${charges.from}:${charges.cost}`;
