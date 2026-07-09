import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

export const createGameActiveEffectIdFx = Effect.fn("createGameActiveEffectIdFx")(function* () {
	return `effect-instance:${createId()}`;
});
