import { Effect } from "effect";
import { bootstrapState } from "../logic/bootstrapState";

export const readGameConfigHashFx = Effect.fn("readGameConfigHashFx")(function* () {
	return bootstrapState.configHash;
});
