import { rm } from "node:fs/promises";
import { Effect } from "effect";
import { resolveSerakkiUserDataPathsFx } from "~/application-data/fx/resolveSerakkiUserDataPathsFx";

export const applicationHardResetArgument = "--serakki-hard-reset";

/** Runs after acquiring the single-instance lock, before any data writers are created. */
export const consumeApplicationHardResetFx = Effect.gen(function* () {
	if (!process.argv.includes(applicationHardResetArgument)) return;
	// Consume even on failure: a later ordinary relaunch must never repeat the deletion.
	process.argv = process.argv.filter((argument) => argument !== applicationHardResetArgument);
	const paths = yield* resolveSerakkiUserDataPathsFx;
	yield* Effect.tryPromise({
		try: () =>
			rm(paths.root, {
				recursive: true,
				force: true,
				maxRetries: 3,
			}),
		catch: (cause) => cause,
	});
});
