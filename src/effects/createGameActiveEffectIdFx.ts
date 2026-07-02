import { Effect } from "effect";
import { createGameActiveEffectId } from "~/engine/logic/createGameEntityId";

export const createGameActiveEffectIdFx = Effect.fn("createGameActiveEffectIdFx")(function* () {
	return createGameActiveEffectId();
});
