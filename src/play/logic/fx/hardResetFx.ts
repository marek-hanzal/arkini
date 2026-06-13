import { Effect } from "effect";
import { bootstrapState } from "./bootstrapState";
import { tryGameActionFx } from "./tryGameActionFx";

export const hardResetFx = Effect.fn("hardResetFx")(function* () {
	bootstrapState.reset();

	const { sqlite } = yield* tryGameActionFx(() => import("~/database/local/client"));
	yield* tryGameActionFx(() => sqlite.deleteDatabaseFile(undefined, true));
});
