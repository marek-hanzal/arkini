import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { checkBoardItemsSwapReadinessFx } from "~/board/checkBoardItemsSwapReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { GameActionBoardItemsSwapSchema } from "~/action/GameActionBoardItemsSwapSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace swapBoardItemsFx {
	export interface Props {
		action: GameActionBoardItemsSwapSchema.Type;
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const swapBoardItemsFx = Effect.fn("swapBoardItemsFx")(function* ({
	action,
	config,
	save,
	nowMs,
}: swapBoardItemsFx.Props) {
	const { source, target } = yield* checkBoardItemsSwapReadinessFx({
		action,
		save,
	});

	if (action.sourceBoardItemId === action.targetBoardItemId) {
		return yield* createGameEngineResultFx({
			config,
			events: [],
			nowMs,
			save,
		});
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

	return yield* createGameEngineResultFx({
		config,
		events: [],
		nowMs,
		save: nextSave,
	});
});
