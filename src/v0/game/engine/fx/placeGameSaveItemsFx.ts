import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { placeSingleGameSaveItemRequestFx } from "~/v0/game/engine/fx/placeSingleGameSaveItemRequestFx";
import type { BoardCell } from "~/v0/game/engine/model/BoardCell";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/engine/model/GameSaveItemPlacementRequest";
import type { GameSaveItemPlacementResult } from "~/v0/game/engine/model/GameSaveItemPlacementResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace placeGameSaveItemsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		items: GameSaveItemPlacementRequest[];
		nowMs: number;
		seedCell?: BoardCell;
	}
}

export const placeGameSaveItemsFx = Effect.fn("placeGameSaveItemsFx")(function* ({
	config,
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
			item,
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
