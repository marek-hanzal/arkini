import { match } from "ts-pattern";
import type { GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import type { UpgradeEffectDefinition } from "~/v0/manifest/upgrade/UpgradeEffectDefinition";

export function describeUpgradeEffect(
	gameConfig: GameConfigService,
	effect: UpgradeEffectDefinition,
) {
	return match(effect)
		.with(
			{
				type: "producer.cooldown.add",
			},
			(effect) => {
				const item = gameConfig.getItem(effect.itemId);
				const seconds = Math.abs(effect.ms) / 1000;
				return `${item?.name ?? effect.itemId}: ${effect.ms < 0 ? "-" : "+"}${seconds.toFixed(1)}s cooldown`;
			},
		)
		.with(
			{
				type: "producer.outputTable.set",
			},
			(effect) => {
				const item = gameConfig.getItem(effect.itemId);
				const table = gameConfig.getLootTable(effect.tableId);
				return `${item?.name ?? effect.itemId}: ${table?.name ?? effect.tableId}`;
			},
		)
		.exhaustive();
}
