import { Effect } from "effect";

import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";

/** Reads the current canonical speed mode from the loaded runtime session. */
export const readSpeedModeFx = Effect.fn("readSpeedModeFx")(function* () {
	return (yield* readRuntimeFx()).session.speedMode;
});
