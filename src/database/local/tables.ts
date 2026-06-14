import type { Database } from "./schema";

export const table = {
	metadata: "metadata",
	saveGame: "saveGame",
	boardItem: "boardItem",
	inventoryStack: "inventoryStack",
	playerUpgrade: "playerUpgrade",
} as const satisfies { [Name in keyof Database]: Name };
