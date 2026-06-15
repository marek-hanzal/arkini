import { Effect } from "effect";
import { bootstrapState } from "~/v0/play/fx/bootstrapState";

export const readGameConfigHashFx = Effect.fn("readGameConfigHashFx")(function* () {
	return bootstrapState.configHash;
});
