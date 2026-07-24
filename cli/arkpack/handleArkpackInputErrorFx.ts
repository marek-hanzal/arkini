import { Console, Effect } from "effect";

import { ArkpackInputError } from "~/engine/pack/error/ArkpackInputError";

/** Renders one expected Arkpack CLI input failure and marks the process unsuccessful. */
export const handleArkpackInputErrorFx = Effect.fn("handleArkpackInputErrorFx")(
	(error: unknown) => {
		if (!(error instanceof ArkpackInputError)) return Effect.fail(error);
		return Console.error(error.message).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					process.exitCode = 1;
				}),
			),
		);
	},
);
