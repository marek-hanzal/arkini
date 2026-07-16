import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameAudioBoardItemId } from "~/audio/readGameAudioBoardItemId";

export const isStashLineAudioEvent = ({
	config,
	currentSave,
	itemInstanceId,
	previousSave,
}: {
	config: GameConfig;
	currentSave: GameSave;
	itemInstanceId: string;
	previousSave: GameSave;
}) => {
	const itemId = readGameAudioBoardItemId({
		currentSave,
		itemInstanceId,
		previousSave,
	});
	if (!itemId) return false;

	return Boolean(config.items[itemId]?.stash);
};
