import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";

export namespace assertBoardCellInsideBoundsFx {
	export interface Props {
		config: GameConfig;
		x: number;
		y: number;
	}
}

export const assertBoardCellInsideBoundsFx = Effect.fn("assertBoardCellInsideBoundsFx")(function* ({
	config,
	x,
	y,
}: assertBoardCellInsideBoundsFx.Props) {
	if (x < config.game.board.width && y < config.game.board.height) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected("unsupported_target", "Board cell is outside board."),
	);
});
