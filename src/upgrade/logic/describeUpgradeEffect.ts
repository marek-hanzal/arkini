import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { UpgradeEffectDefinition } from "~/manifest/data/upgrade";

export function describeUpgradeEffect(
	gameConfig: GameConfigService,
	effect: UpgradeEffectDefinition,
) {
	switch (effect.type) {
		case "producer.cooldown.add": {
			const item = gameConfig.getItem(effect.itemId);
			const seconds = Math.abs(effect.ms) / 1000;
			return `${item?.name ?? effect.itemId}: ${effect.ms < 0 ? "-" : "+"}${seconds.toFixed(1)}s cooldown`;
		}
		case "producer.outputTable.set": {
			const item = gameConfig.getItem(effect.itemId);
			const table = gameConfig.getLootTable(effect.tableId);
			return `${item?.name ?? effect.itemId}: ${table?.name ?? effect.tableId}`;
		}
	}
}
