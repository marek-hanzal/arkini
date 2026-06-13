import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { UpgradeEffectDefinition } from "~/manifest/data/upgrade";

export interface OwnedUpgradeRow {
	upgradeDefinitionId: string;
	level: number;
}

export function readOwnedUpgradeEffects(
	gameConfig: GameConfigService,
	rows: readonly OwnedUpgradeRow[],
): UpgradeEffectDefinition[] {
	const effects: UpgradeEffectDefinition[] = [];

	for (const row of rows) {
		const upgrade = gameConfig.getUpgrade(row.upgradeDefinitionId);
		if (!upgrade) continue;
		const ownedTiers = upgrade.tiers.slice(0, Math.max(0, row.level));
		for (const tier of ownedTiers) effects.push(...tier.effects);
	}

	return effects;
}
