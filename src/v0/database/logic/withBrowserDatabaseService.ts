import { Effect } from "effect";
import {
	BrowserDatabaseServiceFx,
	type BrowserDatabaseService,
} from "~/v0/database/context/BrowserDatabaseServiceFx";

export function withBrowserDatabaseService(database: BrowserDatabaseService) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		return effect.pipe(Effect.provideService(BrowserDatabaseServiceFx, database));
	};
}
