import type { UpgradeEffectDefinition } from "~/manifest/data/upgrade";

export function readInventoryCapacityBonus(
	effects: readonly UpgradeEffectDefinition[],
	inventory: "board" | "player",
) {
	return effects.reduce((sum, effect) => {
		if (effect.type !== "inventory.capacity.add") return sum;
		if (effect.inventory !== inventory) return sum;
		return sum + effect.slots;
	}, 0);
}
