import type { Database } from "./schema";

/**
 * GPT:FIX
 *
 * Remove this - Kysely already provides typed table names in database, so you con't need to do this kind of shit here.
 */
export const table = {
	metadata: "metadata",
	saveGame: "saveGame",
	itemInstance: "itemInstance",
	playerUpgrade: "playerUpgrade",
} as const satisfies { [Name in keyof Database]: Name };
