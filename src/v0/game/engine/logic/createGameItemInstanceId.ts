import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const createGameItemInstanceId = (save: GameSave): string => {
	const id = `item-instance:${save.nextItemInstanceIndex}`;
	save.nextItemInstanceIndex += 1;
	return id;
};
