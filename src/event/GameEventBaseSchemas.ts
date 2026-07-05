import { z } from "zod";

export const IdSchema = z.string().min(1);
export const NonNegativeIntegerSchema = z.number().int().min(0);
export const PositiveIntegerSchema = z.number().int().positive();

export const GameItemCreatedReasonSchema = z.enum([
	"line-output",
	"producer-input-withdraw",
	"craft-input-withdraw",
	"inventory-placement",
	"board-stash",
	"tile-remove-output",
	"merge-output",
	"memory-restore",
	"memory-store",
	"debug",
]);

export const GameItemConsumedReasonSchema = z.enum([
	"line-input",
	"producer-input-store",
	"producer-input-auto-fill",
	"craft-input",
	"craft-input-store",
	"craft-input-auto-fill",
	"inventory-placement",
	"board-stash",
	"remove-tool",
	"merge-source",
	"memory-restore",
	"memory-store",
]);

export const GameBoardItemChangeReasonSchema = z.enum([
	"debug-delete",
	"capacity-depleted",
	"producer-depleted",
	"tile-remove",
	"merge-result",
	"craft-result",
]);

export const GameEventPlacementTargetSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("board"),
			itemInstanceId: IdSchema,
			quantity: PositiveIntegerSchema.optional(),
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

export const GameEventItemConsumedSourceSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("board"),
			itemInstanceId: IdSchema,
			quantity: PositiveIntegerSchema.optional(),
			previousQuantity: PositiveIntegerSchema.optional(),
			nextQuantity: NonNegativeIntegerSchema.optional(),
		})
		.strict(),
	z
		.object({
			kind: z.literal("inventory"),
			slotIndex: NonNegativeIntegerSchema,
			quantity: PositiveIntegerSchema,
			previousQuantity: PositiveIntegerSchema,
			nextQuantity: NonNegativeIntegerSchema,
		})
		.strict(),
]);

export const GameSpeedModeSchema = z.enum([
	"normal",
	"instant",
]);
