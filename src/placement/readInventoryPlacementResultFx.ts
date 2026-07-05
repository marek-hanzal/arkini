import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { PlaceInventoryItemOnBoardProps } from "~/placement/InventoryItemOnBoardPlacementTypes";

export const readInventoryPlacementResultFx = Effect.fn("readInventoryPlacementResultFx")(
	function* ({
		events,
		props,
		save,
	}: {
		events: GameEvent[];
		props: PlaceInventoryItemOnBoardProps;
		save: GameSave;
	}) {
		return yield* createGameEngineResultFx({
			config: props.config,
			events,
			nowMs: props.nowMs,
			save,
		});
	},
);
