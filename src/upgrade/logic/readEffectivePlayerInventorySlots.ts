import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { OwnedUpgradeRow } from "~/upgrade/logic/readOwnedUpgradeEffects";
import { readInventoryCapacityBonus } from "~/upgrade/logic/readInventoryCapacityBonus";
import { readOwnedUpgradeEffects } from "~/upgrade/logic/readOwnedUpgradeEffects";

export function readEffectivePlayerInventorySlots(
	gameConfig: GameConfigService,
	rows: readonly OwnedUpgradeRow[],
) {
	return (
		gameConfig.config.game.playerInventory.slots +
		readInventoryCapacityBonus(readOwnedUpgradeEffects(gameConfig, rows), "player")
	);
}
