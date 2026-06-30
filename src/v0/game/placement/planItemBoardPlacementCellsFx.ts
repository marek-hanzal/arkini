import { Effect } from "effect";
import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { planEmptyBoardCellsFx } from "~/v0/game/placement/planEmptyBoardCellsFx";

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
