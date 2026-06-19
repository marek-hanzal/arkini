import type { GameUpgradeTierDefinition } from "~/v0/game/upgrade/GameUpgradeTierDefinition";

export interface GameUpgradeDefinition {
	code: string;
	description: string;
	name: string;
	sort: number;
	tiers: readonly GameUpgradeTierDefinition[];
}
