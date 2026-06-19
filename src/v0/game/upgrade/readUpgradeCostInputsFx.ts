import { Effect } from "effect";
import type { GameUpgradeCostInput } from "~/v0/game/upgrade/GameUpgradeCostInput";
import type { GameUpgradeDefinition } from "~/v0/game/upgrade/GameUpgradeDefinition";

export namespace readUpgradeCostInputsFx {
	export interface Props {
		upgrade: GameUpgradeDefinition;
		tierIndex: number;
	}
}

export const readUpgradeCostInputsFx = Effect.fn("readUpgradeCostInputsFx")(function* ({
	upgrade,
	tierIndex,
}: readUpgradeCostInputsFx.Props) {
	const tier = upgrade.tiers[tierIndex];
	const inputs: GameUpgradeCostInput[] = tier
		? tier.cost.map((cost) => ({
				consume: true,
				itemId: cost.itemId,
				quantity: cost.quantity,
			}))
		: [];
	return inputs;
});
