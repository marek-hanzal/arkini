import type { GameUpgradeTierDefinition } from "~/v0/game/engine/model/GameUpgradeTierDefinition";

export interface GameUpgradeDefinition {
	code: string;
	description: string;
	name: string;
	sort: number;
	tiers: readonly GameUpgradeTierDefinition[];
}
