import { Effect } from "effect";
import { createGameItemSpawnJobId } from "~/engine/logic/createGameEntityId";

export const createGameItemSpawnJobIdFx = Effect.fn("createGameItemSpawnJobIdFx")(function* () {
	return createGameItemSpawnJobId();
});
