import { Effect } from "effect";
import { bootstrapState } from "../logic/bootstrapState";
import { tryGameAction } from "../logic/tryGameAction";

export const hardResetFx = Effect.fn("hardResetFx")(function* () {
	bootstrapState.reset();

	const { sqlite } = yield* tryGameAction(() => import("~/database/local/client"));
	yield* tryGameAction(() => sqlite.deleteDatabaseFile(undefined, true));
});
