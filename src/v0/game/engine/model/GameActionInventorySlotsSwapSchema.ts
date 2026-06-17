import { z } from "zod";

const NonNegativeIntegerSchema = z.number().int().min(0);

export const GameActionInventorySlotsSwapSchema = z
	.object({
		sourceSlotIndex: NonNegativeIntegerSchema,
		targetSlotIndex: NonNegativeIntegerSchema,
		type: z.literal("inventory.slots.swap"),
	})
	.strict();

export type GameActionInventorySlotsSwapSchema = typeof GameActionInventorySlotsSwapSchema;

export namespace GameActionInventorySlotsSwapSchema {
	export type Type = z.infer<typeof GameActionInventorySlotsSwapSchema>;
}
