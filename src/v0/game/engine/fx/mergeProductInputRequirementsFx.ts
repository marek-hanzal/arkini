import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameProductInputRequirement } from "~/v0/game/engine/model/GameProductInputRequirement";

export namespace mergeProductInputRequirementsFx {
	export interface Props {
		inputs: GameConfig["products"][string]["inputs"];
	}
}

export const mergeProductInputRequirementsFx = Effect.fn("mergeProductInputRequirementsFx")(
	function* ({ inputs }: mergeProductInputRequirementsFx.Props) {
		const map = new Map<string, GameProductInputRequirement>();
		for (const input of inputs) {
			const previous = map.get(input.itemId);
			map.set(input.itemId, {
				consume: (previous?.consume ?? false) || input.consume,
				quantity: (previous?.quantity ?? 0) + input.quantity,
			});
		}
		return map;
	},
);
