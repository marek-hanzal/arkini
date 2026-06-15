import { Effect } from "effect";
import { type DateServiceFx } from "~/date/context/DateServiceFx";
import { DateServiceLive } from "~/date/logic/DateServiceLive";
import { withDateService } from "~/date/logic/withDateService";
import { type BrowserDatabaseServiceFx } from "~/database/context/BrowserDatabaseServiceFx";
import { type KyselyContextFx } from "~/database/context/KyselyContextFx";
import { db } from "~/database/local/db";
import { BrowserDatabaseServiceLive } from "~/database/logic/BrowserDatabaseServiceLive";
import { withBrowserDatabaseService } from "~/database/logic/withBrowserDatabaseService";
import { withKysely } from "~/database/logic/withKysely";
import { type HashServiceFx } from "~/hash/context/HashServiceFx";
import { HashServiceLive } from "~/hash/logic/HashServiceLive";
import { withHashService } from "~/hash/logic/withHashService";
import { type IdServiceFx } from "~/id/context/IdServiceFx";
import { IdServiceLive } from "~/id/logic/IdServiceLive";
import { withIdService } from "~/id/logic/withIdService";
import { type GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { GameConfigServiceLive } from "~/manifest/logic/GameConfigServiceLive";
import { withGameConfigService } from "~/manifest/logic/withGameConfigService";
import { type RandomServiceFx } from "~/random/context/RandomServiceFx";
import { RandomServiceLive } from "~/random/logic/RandomServiceLive";
import { withRandomService } from "~/random/logic/withRandomService";

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
