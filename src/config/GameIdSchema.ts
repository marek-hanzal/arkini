import { z } from "zod";

/**
 * Runtime IDs are authored in compiled JSON and cross-reference validated by
 * `GameConfigSchema` / `GameSaveConfigSchema`. Keep the local value schema generic;
 * stale TS enum mirrors were the old manifest's problem, not runtime truth.
 */
export const GameItemIdSchema = z.string().min(1);

export namespace GameItemIdSchema {
	export type Type = z.infer<typeof GameItemIdSchema>;
}

export type ItemId = GameItemIdSchema.Type;
