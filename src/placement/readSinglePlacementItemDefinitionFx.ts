import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";

export const readSinglePlacementItemDefinitionFx = Effect.fn("readSinglePlacementItemDefinitionFx")(
	function* ({ config, item }: { config: GameConfig; item: GameSaveItemPlacementRequest }) {
		const itemDefinition = config.items[item.itemId];
		if (itemDefinition) return itemDefinition;

		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${item.itemId}".`),
		);
	},
);
