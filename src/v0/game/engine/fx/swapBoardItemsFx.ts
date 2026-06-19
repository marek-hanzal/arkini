import { Effect } from "effect";
import { checkBoardItemsSwapReadinessFx } from "~/v0/game/engine/fx/checkBoardItemsSwapReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameActionBoardItemsSwapSchema } from "~/v0/game/engine/model/GameActionBoardItemsSwapSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace swapBoardItemsFx {
	export interface Props {
		action: GameActionBoardItemsSwapSchema.Type;
		save: GameSave;
		nowMs: number;
	}
}

export const swapBoardItemsFx = Effect.fn("swapBoardItemsFx")(function* ({
	action,
	save,
	nowMs,
}: swapBoardItemsFx.Props) {
	if (action.sourceBoardItemId === action.targetBoardItemId) {
		return {
			events: [],
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				save,
			}),
			save,
		} satisfies GameEngineResult;
	}

	const { source, target } = yield* checkBoardItemsSwapReadinessFx({
		action,
		save,
	});
	if (!source || !target) {
		return {
			events: [],
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				save,
			}),
			save,
		} satisfies GameEngineResult;
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const liveSource = nextSave.board.items[source.id];
	const liveTarget = nextSave.board.items[target.id];
	if (!liveSource || !liveTarget) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board item disappeared."),
		);
	}

	const sourcePosition = {
		x: liveSource.x,
		y: liveSource.y,
	};
	liveSource.x = liveTarget.x;
	liveSource.y = liveTarget.y;
	liveTarget.x = sourcePosition.x;
	liveTarget.y = sourcePosition.y;
	nextSave.updatedAtMs = nowMs;

	return {
		events: [],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
