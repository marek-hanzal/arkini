import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { placeSingleGameSaveItemRequestFx } from "~/placement/placeSingleGameSaveItemRequestFx";
import type { BoardCell } from "~/board/logic/BoardCell";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import type { GameSaveItemPlacementResult } from "~/placement/GameSaveItemPlacementResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace placeGameSaveItemsFx {
	export interface Props {
		config: GameConfig;
		freedBoardItemInstanceIds?: ReadonlySet<string>;
		save: GameSave;
		items: GameSaveItemPlacementRequest[];
		nowMs: number;
		seedCell?: BoardCell;
	}
}

export const placeGameSaveItemsFx = Effect.fn("placeGameSaveItemsFx")(function* ({
	config,
	freedBoardItemInstanceIds,
	save,
	items,
	nowMs,
	seedCell,
}: placeGameSaveItemsFx.Props) {
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	for (const item of items) {
		yield* placeSingleGameSaveItemRequestFx({
			config,
			events,
			freedBoardItemInstanceIds,
			item,
			nowMs,
			save: nextSave,
			seedCell,
		});
	}

	nextSave.updatedAtMs = nowMs;

	return {
		events,
		save: nextSave,
		type: "placed",
	} satisfies GameSaveItemPlacementResult;
});
