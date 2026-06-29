import { Effect } from "effect";
import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameEffectItemCreateBlockReasons } from "~/v0/game/effects/readGameEffectItemCreateBlockReasons";
import { readGameEffectItemCreateMissingGrant } from "~/v0/game/effects/readGameEffectItemCreateMissingGrant";
import { planEmptyBoardCellsFx } from "~/v0/game/placement/planEmptyBoardCellsFx";

export namespace planItemBoardPlacementCellsFx {
	export interface Props {
		config: GameConfig;
		itemId: string;
		nowMs?: number;
		save: GameSave;
		seedCell?: BoardCell;
	}
}

export const planItemBoardPlacementCellsFx = Effect.fn("planItemBoardPlacementCellsFx")(function* ({
	config,
	itemId,
	nowMs,
	save,
	seedCell,
}: planItemBoardPlacementCellsFx.Props) {
	const emptyCells = yield* planEmptyBoardCellsFx({
		config,
		save,
		seedCell,
	});

	return emptyCells.filter(
		(targetCell) =>
			!readGameEffectItemCreateMissingGrant({
				config,
				itemId,
				nowMs,
				save,
				targetCell,
			}) &&
			readGameEffectItemCreateBlockReasons({
				config,
				itemId,
				nowMs,
				save,
				targetCell,
			}).length === 0,
	);
});
