import { z } from "zod";

const IdSchema = z.string().min(1);
const PositiveIntegerSchema = z.number().int().positive();

export const GameActionStoredRequirementWithdrawSchema = z
	.object({
		itemId: IdSchema,
		quantity: PositiveIntegerSchema,
		targetItemInstanceId: IdSchema,
		type: z.literal("stored_requirement.withdraw"),
	})
	.strict();

export type GameActionStoredRequirementWithdrawSchema =
	typeof GameActionStoredRequirementWithdrawSchema;

export namespace GameActionStoredRequirementWithdrawSchema {
	export type Type = z.infer<typeof GameActionStoredRequirementWithdrawSchema>;
}
