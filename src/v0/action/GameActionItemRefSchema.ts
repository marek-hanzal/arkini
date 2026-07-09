import { z } from "zod";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();

export const GameActionItemRefSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("board"),
			itemInstanceId: IdSchema,
			quantity: PositiveIntegerSchema.optional(),
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

export namespace GameActionItemRefSchema {
	export type Type = z.infer<typeof GameActionItemRefSchema>;
}

export type GameActionItemRef = GameActionItemRefSchema.Type;
