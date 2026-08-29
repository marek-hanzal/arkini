export const ItemTypeLabel = {
	blueprint: "Blueprint",
	craft: "Craft owner",
	deposit: "Resource deposit",
	inventory: "Inventory control",
	producer: "Producer",
	simple: "Simple item",
	space: "Space item",
	stash: "Stash",
	temporary: "Temporary item",
} as const;

export const ItemStorageScopeLabel = {
	any: "Board, Inventory & Toolbar",
	board: "Board only",
	inventory: "Inventory only",
	toolbar: "Toolbar only",
} as const;
