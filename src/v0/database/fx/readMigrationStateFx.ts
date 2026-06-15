import { Effect } from "effect";
import { bootstrapState } from "~/v0/play/bootstrap/bootstrapState";

export const readMigrationStateFx = Effect.fn("readMigrationStateFx")(function* () {
	return bootstrapState.migration;
});
