import { Effect } from "effect";
import { readBoardItemRuntimeStateStatus } from "~/v0/game/board/readBoardItemRuntimeStateStatus";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkBoardItemIdleFx {
	export interface Props {
		itemInstanceId: string;
		message: string;
		save: GameSave;
	}
}

export const checkBoardItemIdleFx = Effect.fn("checkBoardItemIdleFx")(function* ({
	itemInstanceId,
	message,
	save,
}: checkBoardItemIdleFx.Props) {
	const stateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId,
		save,
	});
	if (!stateStatus.busy) return;

	return yield* Effect.fail(GameEngineError.actionRejected("item_busy", message));
});
