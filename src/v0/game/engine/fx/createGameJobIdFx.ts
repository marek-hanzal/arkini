import { Effect } from "effect";
import { createGameJobId } from "~/v0/game/engine/logic/createGameEntityId";

export const createGameJobIdFx = Effect.fn("createGameJobIdFx")(function* () {
	return createGameJobId();
});
