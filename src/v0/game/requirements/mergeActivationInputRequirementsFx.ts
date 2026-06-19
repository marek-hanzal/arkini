import { Effect } from "effect";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import type { GameActivationInputRequirement } from "~/v0/game/requirements/GameActivationInputRequirement";

export namespace mergeActivationInputRequirementsFx {
	export interface Props {
		inputs: readonly GameActivationInput[];
	}
}

export const mergeActivationInputRequirementsFx = Effect.fn("mergeActivationInputRequirementsFx")(
	function* ({ inputs }: mergeActivationInputRequirementsFx.Props) {
		const map = new Map<string, GameActivationInputRequirement>();
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
