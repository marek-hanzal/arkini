import { Effect } from "effect";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { withDateService } from "~/v0/date/logic/withDateService";
import { BrowserDatabaseServiceFx } from "~/v0/database/context/BrowserDatabaseServiceFx";
import { KyselyContextFx } from "~/v0/database/context/KyselyContextFx";
import { withKysely } from "~/v0/database/logic/withKysely";
import { HashServiceFx } from "~/v0/hash/context/HashServiceFx";
import { withHashService } from "~/v0/hash/logic/withHashService";
import { IdServiceFx } from "~/v0/id/context/IdServiceFx";
import { withIdService } from "~/v0/id/logic/withIdService";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import { withGameConfigService } from "~/v0/game/logic/withGameConfigService";
import { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";
import { withRandomService } from "~/v0/random/logic/withRandomService";
import { bootstrapState } from "./bootstrapState";
import { tryGameAction } from "./tryGameAction";
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
			const result = yield* tryGameAction(() => browserDatabase.migrateToLatest());

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
