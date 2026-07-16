interface LootTableItemRoll {
	itemId: string;
	quantity: number;
}

export interface LootTableRollResult {
	items: LootTableItemRoll[];
}
