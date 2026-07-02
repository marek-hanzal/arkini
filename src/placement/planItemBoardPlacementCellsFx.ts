import { Effect } from "effect";
import type { BoardCell } from "~/board/logic/BoardCell";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";

export namespace planItemBoardPlacementCellsFx {
	export interface Props {
		config: GameConfig;
		freedBoardItemInstanceIds?: ReadonlySet<string>;
		itemId: string;
		nowMs?: number;
		save: GameSave;
		seedCell?: BoardCell;
	}
}

export const planItemBoardPlacementCellsFx = Effect.fn("planItemBoardPlacementCellsFx")(function* ({
	config,
	freedBoardItemInstanceIds,
	save,
	seedCell,
}: planItemBoardPlacementCellsFx.Props) {
	return yield* planEmptyBoardCellsFx({
		config,
		freedBoardItemInstanceIds,
		save,
		seedCell,
	});
});
