import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { planEmptyBoardCellsFx } from "~/v0/game/placement/planEmptyBoardCellsFx";
import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace findFirstEmptyBoardCellFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		seedCell?: BoardCell;
	}
}

export const findFirstEmptyBoardCellFx = Effect.fn("findFirstEmptyBoardCellFx")(function* ({
	config,
	save,
	seedCell,
}: findFirstEmptyBoardCellFx.Props) {
	const [firstCell] = yield* planEmptyBoardCellsFx({
		config,
		save,
		seedCell,
	});

	return firstCell ?? null;
});
