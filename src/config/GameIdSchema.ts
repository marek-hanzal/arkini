import { z } from "zod";

/**
 * Runtime IDs are authored in source JSON and cross-reference validated by
 * `GameConfigSchema` / `GameSaveConfigSchema`. Keep the local value schema generic;
 * config/save validation owns domain truth.
 */
export const GameItemIdSchema = z.string().min(1);

export namespace GameItemIdSchema {
	export type Type = z.infer<typeof GameItemIdSchema>;
}

export type ItemId = GameItemIdSchema.Type;
