import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";

export namespace readGameConfigItemDefinitionFx {
	export interface Props {
		config: GameConfig;
		itemId: string;
	}
}

export const readGameConfigItemDefinitionFx = Effect.fn("readGameConfigItemDefinitionFx")(
	function* ({ config, itemId }: readGameConfigItemDefinitionFx.Props) {
		const itemDefinition = config.items[itemId];
		if (!itemDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${itemId}".`),
			);
		}

		return itemDefinition;
	},
);
