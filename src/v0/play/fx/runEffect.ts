import { Effect } from "effect";
import { type DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { DateServiceLive } from "~/v0/date/logic/DateServiceLive";
import { withDateService } from "~/v0/date/logic/withDateService";
import { type BrowserDatabaseServiceFx } from "~/v0/database/context/BrowserDatabaseServiceFx";
import { type KyselyContextFx } from "~/v0/database/context/KyselyContextFx";
import { db } from "~/v0/database/local/db";
import { BrowserDatabaseServiceLive } from "~/v0/database/logic/BrowserDatabaseServiceLive";
import { withBrowserDatabaseService } from "~/v0/database/logic/withBrowserDatabaseService";
import { withKysely } from "~/v0/database/logic/withKysely";
import { type HashServiceFx } from "~/v0/hash/context/HashServiceFx";
import { HashServiceLive } from "~/v0/hash/logic/HashServiceLive";
import { withHashService } from "~/v0/hash/logic/withHashService";
import { type IdServiceFx } from "~/v0/id/context/IdServiceFx";
import { IdServiceLive } from "~/v0/id/logic/IdServiceLive";
import { withIdService } from "~/v0/id/logic/withIdService";
import { type GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import { GameConfigServiceLive } from "~/v0/game/logic/GameConfigServiceLive";
import { withGameConfigService } from "~/v0/game/logic/withGameConfigService";
import { type RandomServiceFx } from "~/v0/random/context/RandomServiceFx";
import { RandomServiceLive } from "~/v0/random/logic/RandomServiceLive";
import { withRandomService } from "~/v0/random/logic/withRandomService";

export type GameRuntimeServiceFx =
	| BrowserDatabaseServiceFx
	| DateServiceFx
	| GameConfigServiceFx
	| HashServiceFx
	| IdServiceFx
	| KyselyContextFx
	| RandomServiceFx;

export function runEffect<T, E, R extends GameRuntimeServiceFx>(effect: Effect.Effect<T, E, R>) {
	const date = DateServiceLive;
	const id = IdServiceLive;
	const runnable = effect.pipe(
		withBrowserDatabaseService(BrowserDatabaseServiceLive),
		withDateService(date),
		withGameConfigService(GameConfigServiceLive),
		withHashService(HashServiceLive),
		withIdService(id),
		withKysely({
			kysely: db,
			isTransaction: false,
		}),
		withRandomService(RandomServiceLive),
	) as Effect.Effect<T, E, never>;

	return Effect.runPromise(runnable);
}
