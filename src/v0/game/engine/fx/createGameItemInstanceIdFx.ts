import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace createGameItemInstanceIdFx {
	export interface Props {
		save: GameSave;
	}
}

export const createGameItemInstanceIdFx = Effect.fn("createGameItemInstanceIdFx")(function* ({
	save,
}: createGameItemInstanceIdFx.Props) {
	const id = `item-instance:${save.nextItemInstanceIndex}`;
	save.nextItemInstanceIndex += 1;
	return id;
});
