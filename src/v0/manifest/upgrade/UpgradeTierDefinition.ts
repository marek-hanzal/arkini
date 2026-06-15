import type { UpgradeCostDefinition } from "~/v0/manifest/upgrade/UpgradeCostDefinition";
import type { UpgradeEffectDefinition } from "~/v0/manifest/upgrade/UpgradeEffectDefinition";

export interface UpgradeTierDefinition {
	cost: readonly UpgradeCostDefinition[];
	effects: readonly UpgradeEffectDefinition[];
	durationMs: number;
}
