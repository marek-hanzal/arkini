import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

export const createGameItemSpawnJobIdFx = Effect.fn("createGameItemSpawnJobIdFx")(function* () {
	return `item-spawn-job:${createId()}`;
});
