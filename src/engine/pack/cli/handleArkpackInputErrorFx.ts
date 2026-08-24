import { Console, Effect } from "effect";

import { ArkpackInputError } from "~/engine/pack/error/ArkpackInputError";

/** Renders one expected Arkpack CLI input failure and marks the process unsuccessful. */
export const handleArkpackInputErrorFx = Effect.fn("handleArkpackInputErrorFx")(function* (
	error: unknown,
) {
	if (!(error instanceof ArkpackInputError)) return yield* Effect.fail(error);
	yield* Console.error(error.message);
	yield* Effect.sync(() => {
		process.exitCode = 1;
	});
});
