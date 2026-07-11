import { Effect } from "effect";

import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";

/**
 * Reads the current immutable runtime snapshot.
 */
export const readRuntimeFx = Effect.fn("readRuntimeFx")(function* () {
	const runtime = yield* RuntimeFx;

	return yield* runtime.read;
});
