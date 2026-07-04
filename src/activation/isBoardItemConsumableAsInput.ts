import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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
