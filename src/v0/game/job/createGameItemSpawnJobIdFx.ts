import { Effect } from "effect";
import { createGameItemSpawnJobId } from "~/v0/game/engine/logic/createGameEntityId";

export const createGameItemSpawnJobIdFx = Effect.fn("createGameItemSpawnJobIdFx")(function* () {
	return createGameItemSpawnJobId();
});
