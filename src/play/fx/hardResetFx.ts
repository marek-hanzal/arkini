import { Effect } from "effect";
import { bootstrapState } from "../logic/bootstrapState";
import { BrowserDatabaseServiceFx } from "~/database/context/BrowserDatabaseServiceFx";
import { tryGameAction } from "../logic/tryGameAction";

export const hardResetFx = Effect.fn("hardResetFx")(function* () {
	bootstrapState.reset();

	const browserDatabase = yield* BrowserDatabaseServiceFx;
	yield* tryGameAction(() => browserDatabase.deleteDatabaseFile());
});
