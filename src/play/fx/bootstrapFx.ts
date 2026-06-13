import { Effect } from "effect";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { withDateService } from "~/date/logic/withDateService";
import { KyselyContextFx } from "~/database/context/KyselyContextFx";
import { withKysely } from "~/database/logic/withKysely";
import { assertBrowserDatabaseSupport } from "~/database/local/capabilities";
import { migrator } from "~/database/local/migrator";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";
import { withRandomService } from "~/random/logic/withRandomService";
import { bootstrapState } from "../logic/bootstrapState";
import { tryGameAction } from "../logic/tryGameAction";
import { ensureDefaultSaveFx } from "./ensureDefaultSaveFx";
import { syncConfigFx } from "./syncConfigFx";

export const bootstrapFx = Effect.fn("bootstrapFx")(function* () {
	assertBrowserDatabaseSupport();

	const existing = bootstrapState.promise;
	if (existing) return yield* tryGameAction(() => existing);

	const date = yield* DateServiceFx;
	const kysely = yield* KyselyContextFx;
	const random = yield* RandomServiceFx;
	const next = Effect.runPromise(
		Effect.gen(function* () {
			const result = yield* tryGameAction(() => migrator.migrateToLatest());

			if (result.error) return yield* Effect.fail(result.error);

			const gameConfigSync = yield* syncConfigFx();
			bootstrapState.configHash = gameConfigSync.hash;
			yield* ensureDefaultSaveFx({
				resetExisting: gameConfigSync.changed,
			});
			bootstrapState.migration = "ready";
		}).pipe(withDateService(date), withKysely(kysely), withRandomService(random)),
	);
	bootstrapState.promise = next;

	return yield* tryGameAction(() => next);
});
