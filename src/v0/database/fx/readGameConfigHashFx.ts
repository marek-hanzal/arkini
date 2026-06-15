import { Effect } from "effect";
import { bootstrapState } from "~/v0/play/bootstrap/bootstrapState";

export const readGameConfigHashFx = Effect.fn("readGameConfigHashFx")(function* () {
	return bootstrapState.configHash;
});
