import { z } from "zod";

const IdSchema = z.string().min(1);
const PositiveIntegerSchema = z.number().int().positive();

export const GameActionCraftInputWithdrawSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		targetItemInstanceId: IdSchema,
		type: z.literal("craft.input.withdraw"),
	})
	.strict();

export type GameActionCraftInputWithdrawSchema = typeof GameActionCraftInputWithdrawSchema;

export namespace GameActionCraftInputWithdrawSchema {
	export type Type = z.infer<typeof GameActionCraftInputWithdrawSchema>;
}
