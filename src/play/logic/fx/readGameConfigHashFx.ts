import { Effect } from "effect";
import { bootstrapState } from "./bootstrapState";

export const readGameConfigHashFx = Effect.fn("readGameConfigHashFx")(function* () {
	return bootstrapState.configHash;
});
