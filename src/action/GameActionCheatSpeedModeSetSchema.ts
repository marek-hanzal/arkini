import { z } from "zod";

export const GameActionCheatSpeedModeSetSchema = z
	.object({
		mode: z.enum([
			"normal",
			"instant",
		]),
		type: z.literal("cheat.speed_mode.set"),
	})
	.strict();

export type GameActionCheatSpeedModeSetSchema = typeof GameActionCheatSpeedModeSetSchema;

export namespace GameActionCheatSpeedModeSetSchema {
	export type Type = z.infer<typeof GameActionCheatSpeedModeSetSchema>;
}
