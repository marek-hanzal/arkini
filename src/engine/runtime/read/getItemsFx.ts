import { Effect } from "effect";

import { readRuntimeFx } from "./readRuntimeFx";

/**
 * Reads every live runtime item in authoritatively stored order.
 */
export const getItemsFx = Effect.fn("getItemsFx")(function* () {
	const runtime = yield* readRuntimeFx();

	return runtime.items;
});
