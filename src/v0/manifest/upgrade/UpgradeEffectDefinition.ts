import type { ItemId, LootTableId } from "~/v0/manifest/manifestId";

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
	  };
