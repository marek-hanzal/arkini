import type { GameSave } from "~/engine/model/GameSaveSchema";

export const readGameAudioBoardItemId = ({
	currentSave,
	itemInstanceId,
	previousSave,
}: {
	currentSave: GameSave;
	itemInstanceId: string;
	previousSave: GameSave;
}) =>
	currentSave.board.items[itemInstanceId]?.itemId ??
	previousSave.board.items[itemInstanceId]?.itemId;
