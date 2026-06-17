import { z } from "zod";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();

export const GameActionItemRefSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("board"),
			itemInstanceId: IdSchema,
		})
		.strict(),
	z
		.object({
			kind: z.literal("inventory"),
			slotIndex: NonNegativeIntegerSchema,
			quantity: PositiveIntegerSchema,
		})
		.strict(),
]);

export const GameActionSchema = z.discriminatedUnion("type", [
	z
		.object({
			// Starts one explicit product line on a board producer tile.
			type: z.literal("producer.product.start"),
			producerItemInstanceId: IdSchema,
			productId: IdSchema,
			inputRefs: z.array(GameActionItemRefSchema),
		})
		.strict(),
]);

export type GameActionItemRef = z.infer<typeof GameActionItemRefSchema>;
export type GameAction = z.infer<typeof GameActionSchema>;
