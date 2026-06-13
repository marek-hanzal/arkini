import type { ItemId, UpgradeId, LootTableId } from "./manifestId";

export interface UpgradeDefinition {
	id: UpgradeId;
	code: string;
	name: string;
	description: string;
	sort: number;
	tiers: readonly UpgradeTierDefinition[];
}

export interface UpgradeTierDefinition {
	cost: readonly UpgradeCostDefinition[];
	effects: readonly UpgradeEffectDefinition[];
	durationMs: number;
}

export interface UpgradeCostDefinition {
	itemId: ItemId;
	quantity: number;
}

export type UpgradeEffectDefinition =
	| {
			type: "producer.cooldown.add";
			itemId: ItemId;
			ms: number;
	  }
	| {
			type: "producer.outputTable.set";
			itemId: ItemId;
			tableId: LootTableId;
	  }
	| {
			type: "inventory.capacity.add";
			inventory: "board" | "player";
			slots: number;
	  };
