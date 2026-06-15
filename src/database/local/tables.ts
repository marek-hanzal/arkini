import type { Database } from "./schema";

export const table = {
	metadata: "metadata",
	saveGame: "saveGame",
	itemInstance: "itemInstance",
	playerUpgrade: "playerUpgrade",
} as const satisfies { [Name in keyof Database]: Name };
