import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";

export interface PlaceSingleGameSaveItemRequestProps {
	config: GameConfig;
	events: GameEvent[];
	freedBoardItemInstanceIds?: ReadonlySet<string>;
	item: GameSaveItemPlacementRequest;
	nowMs: number;
	save: GameSave;
	seedCell?: BoardCell;
}

export type GameSaveSingleItemPlacementResult = {
	type: "placed";
};

export type SingleItemPlacementScope = PlaceSingleGameSaveItemRequestProps & {
	createdAtMs: number | undefined;
	itemDefinition: NonNullable<GameConfig["items"][string]>;
};

export type BoardPlacementStopReason = "board:full" | "board:max-count";

export type BoardPlacementTarget =
	| {
			itemInstanceId: string;
			type: "stack";
	  }
	| {
			cell: BoardCell;
			type: "cell";
	  }
	| {
			type: BoardPlacementStopReason;
	  };

export type BoardPlacementProgress = {
	placedQuantity: number;
	remainingQuantity: number;
	stopReason?: BoardPlacementStopReason;
};
