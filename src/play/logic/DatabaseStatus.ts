export interface DatabaseStatus {
	databasePath: string;
	migrationState: "pending" | "ready";
	gameConfigHash: string;
	assetCount: number;
	itemCount: number;
	mergeCount: number;
	producerCount: number;
	buildRecipeCount: number;
	dropTableCount: number;
	saveGameCount: number;
	boardItemCount: number;
	inventoryStackCount: number;
}
