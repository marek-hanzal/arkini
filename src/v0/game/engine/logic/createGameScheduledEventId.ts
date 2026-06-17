import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const createGameScheduledEventId = (save: GameSave): string => {
	const id = `scheduled-event:${save.nextScheduledEventIndex}`;
	save.nextScheduledEventIndex += 1;
	return id;
};
