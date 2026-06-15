import { Effect } from "effect";
import { bootstrapState } from "../logic/bootstrapState";

export const readMigrationStateFx = Effect.fn("readMigrationStateFx")(function* () {
	return bootstrapState.migration;
});
