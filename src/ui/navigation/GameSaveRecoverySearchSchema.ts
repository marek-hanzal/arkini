import { z } from "zod";

export const GameSaveRecoverySearchSchema = z
	.object({
		packageId: z.string().min(1),
	})
	.strict();

export type GameSaveRecoverySearchSchema = typeof GameSaveRecoverySearchSchema;

export namespace GameSaveRecoverySearchSchema {
	export type Type = z.infer<GameSaveRecoverySearchSchema>;
}
