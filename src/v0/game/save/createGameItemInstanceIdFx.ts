import { Effect } from "effect";
import { createGameItemInstanceId } from "~/v0/game/engine/logic/createGameEntityId";

export const createGameItemInstanceIdFx = Effect.fn("createGameItemInstanceIdFx")(function* () {
	return createGameItemInstanceId();
});
