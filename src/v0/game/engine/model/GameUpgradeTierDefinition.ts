import type { GameUpgradeEffect } from "~/v0/game/engine/model/GameUpgradeEffect";

export interface GameUpgradeTierDefinition {
	cost: readonly {
		itemId: string;
		quantity: number;
	}[];
	durationMs: number;
	effects: readonly GameUpgradeEffect[];
}
