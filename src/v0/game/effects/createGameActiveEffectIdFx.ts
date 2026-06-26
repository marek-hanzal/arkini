import { Effect } from "effect";
import { createGameActiveEffectId } from "~/v0/game/engine/logic/createGameEntityId";

export const createGameActiveEffectIdFx = Effect.fn("createGameActiveEffectIdFx")(function* () {
	return createGameActiveEffectId();
});
