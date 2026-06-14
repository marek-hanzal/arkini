import { Effect } from "effect";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { withDateService } from "~/date/logic/withDateService";
import { BrowserDatabaseServiceFx } from "~/database/context/BrowserDatabaseServiceFx";
import { KyselyContextFx } from "~/database/context/KyselyContextFx";
import { withKysely } from "~/database/logic/withKysely";
import { HashServiceFx } from "~/hash/context/HashServiceFx";
import { withHashService } from "~/hash/logic/withHashService";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { withIdService } from "~/id/logic/withIdService";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { withGameConfigService } from "~/manifest/logic/withGameConfigService";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";
import { withRandomService } from "~/random/logic/withRandomService";
import { bootstrapState } from "../logic/bootstrapState";
import { isRecoverableMigrationError } from "../logic/isRecoverableMigrationError";
import { tryGameAction } from "../logic/tryGameAction";
import { ensureDefaultSaveFx } from "./ensureDefaultSaveFx";
import { syncConfigFx } from "./syncConfigFx";

export const bootstrapFx = Effect.fn("bootstrapFx")(function* () {
	const browserDatabase = yield* BrowserDatabaseServiceFx;
	browserDatabase.assertSupported();

	const existing = bootstrapState.promise;
	if (existing) return yield* tryGameAction(() => existing);

	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const hash = yield* HashServiceFx;
	const id = yield* IdServiceFx;
	const kysely = yield* KyselyContextFx;
	const random = yield* RandomServiceFx;
	const next = Effect.runPromise(
		Effect.gen(function* () {
			let result = yield* tryGameAction(() => browserDatabase.migrateToLatest());

			if (result.error && isRecoverableMigrationError(result.error)) {
				bootstrapState.reset();
				yield* tryGameAction(() => browserDatabase.deleteDatabaseFile());
				result = yield* tryGameAction(() => browserDatabase.migrateToLatest());
			}

			if (result.error) return yield* Effect.fail(result.error);

			const gameConfigSync = yield* syncConfigFx();
			bootstrapState.configHash = gameConfigSync.hash;
			yield* ensureDefaultSaveFx({
				resetExisting: gameConfigSync.changed,
			});
			bootstrapState.migration = "ready";
		}).pipe(
			withDateService(date),
			withGameConfigService(gameConfig),
			withHashService(hash),
			withIdService(id),
			withKysely(kysely),
			withRandomService(random),
		),
	);
	bootstrapState.promise = next;

	return yield* tryGameAction(() => next);
});
