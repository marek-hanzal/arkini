import { z } from "zod";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();

export const GameItemCreatedReasonSchema = z.enum([
	"product-output",
	"craft-output",
	"craft-requirement-return",
	"debug",
]);

export const GameEventPlacementTargetSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("board"),
			itemInstanceId: IdSchema,
			x: NonNegativeIntegerSchema,
			y: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			kind: z.literal("inventory"),
			slotIndex: NonNegativeIntegerSchema,
			quantity: PositiveIntegerSchema,
			previousQuantity: NonNegativeIntegerSchema,
			nextQuantity: PositiveIntegerSchema,
		})
		.strict(),
]);

export const GameEventSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("item.created"),
			itemId: IdSchema,
			originItemInstanceId: IdSchema.optional(),
			reason: GameItemCreatedReasonSchema,
			to: GameEventPlacementTargetSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("product.completed"),
			jobId: IdSchema,
			producerItemInstanceId: IdSchema,
			productId: IdSchema,
			completedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("product.blocked"),
			jobId: IdSchema,
			producerItemInstanceId: IdSchema,
			productId: IdSchema,
			reason: z.literal("placement_unavailable"),
			blockedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("craft.completed"),
			jobId: IdSchema,
			recipeId: IdSchema,
			completedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("craft.blocked"),
			jobId: IdSchema,
			recipeId: IdSchema,
			reason: z.literal("placement_unavailable"),
			blockedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("item.spawn.blocked"),
			scheduledEventId: IdSchema,
			itemId: IdSchema,
			reason: z.literal("placement_unavailable"),
			blockedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
]);

export type GameEventPlacementTarget = z.infer<typeof GameEventPlacementTargetSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
