import { Effect } from "effect";
import { assertBrowserDatabaseSupport } from "~/database/local/capabilities";
import { migrator } from "~/database/local/migrator";
import { ensureDefaultSaveFx } from "./ensureDefaultSaveFx";
import { bootstrapState } from "./bootstrapState";
import { syncConfigFx } from "./syncConfigFx";
import { tryGameActionFx } from "./tryGameActionFx";

export const bootstrapFx = Effect.fn("bootstrapFx")(function* () {
	assertBrowserDatabaseSupport();

	const existing = bootstrapState.promise;
	if (existing) return yield* tryGameActionFx(() => existing);

	const next = Effect.runPromise(
		Effect.gen(function* () {
			const result = yield* tryGameActionFx(() => migrator.migrateToLatest());

			if (result.error) return yield* Effect.fail(result.error);

			const gameConfigSync = yield* syncConfigFx();
			bootstrapState.configHash = gameConfigSync.hash;
			yield* ensureDefaultSaveFx({
				resetExisting: gameConfigSync.changed,
			});
			bootstrapState.migration = "ready";
		}),
	);
	bootstrapState.promise = next;

	return yield* tryGameActionFx(() => next);
});
