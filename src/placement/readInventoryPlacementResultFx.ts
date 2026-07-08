import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";

export const readInventoryPlacementResultFx = Effect.fn("readInventoryPlacementResultFx")(
	function* ({
		config,
		events,
		nowMs,
		save,
	}: {
		config: GameConfig;
		events: GameEvent[];
		nowMs: number;
		save: GameSave;
	}) {
		return yield* createGameEngineResultFx({
			config,
			events,
			nowMs,
			save,
		});
	},
);
