import { readBoardItemRuntimeStateStatus } from "~/v0/game/board/readBoardItemRuntimeStateStatus";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const isBoardItemConsumableAsInput = ({
	itemInstanceId,
	save,
}: {
	itemInstanceId: string;
	save: GameSave;
}) => {
	const status = readBoardItemRuntimeStateStatus({
		itemInstanceId,
		save,
	});
	return !status.busy && !status.preservable;
};
