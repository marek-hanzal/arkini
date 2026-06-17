import { z } from "zod";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();

export const GameItemCreatedReasonSchema = z.enum([
	"product-output",
	"craft-output",
	"craft-requirement-return",
	"stash-output",
	"stored-requirement-withdraw",
	"debug",
]);

export const GameItemConsumedReasonSchema = z.enum([
	"product-input",
	"stash-input",
	"craft-input",
	"craft-requirement",
	"stored-requirement-store",
	"remove-tool",
	"merge-source",
	"upgrade-cost",
]);

export const GameBoardItemChangeReasonSchema = z.enum([
	"stash-depleted",
	"tile-remove",
	"merge-result",
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
			type: z.literal("item.consumed"),
			itemId: IdSchema,
			reason: GameItemConsumedReasonSchema,
			from: z.discriminatedUnion("kind", [
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
						previousQuantity: PositiveIntegerSchema,
						nextQuantity: NonNegativeIntegerSchema,
					})
					.strict(),
			]),
		})
		.strict(),
	z
		.object({
			type: z.literal("item.removed"),
			itemId: IdSchema,
			itemInstanceId: IdSchema,
			reason: GameBoardItemChangeReasonSchema,
			removedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("item.replaced"),
			fromItemId: IdSchema,
			itemInstanceId: IdSchema,
			reason: GameBoardItemChangeReasonSchema,
			replacedAtMs: NonNegativeIntegerSchema,
			toItemId: IdSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("stored_requirement.stored"),
			targetItemInstanceId: IdSchema,
			itemId: IdSchema,
			quantity: PositiveIntegerSchema,
			previousQuantity: NonNegativeIntegerSchema,
			nextQuantity: PositiveIntegerSchema,
			storedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("stored_requirement.withdrawn"),
			targetItemInstanceId: IdSchema,
			itemId: IdSchema,
			quantity: PositiveIntegerSchema,
			previousQuantity: PositiveIntegerSchema,
			nextQuantity: NonNegativeIntegerSchema,
			withdrawnAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("product.started"),
			jobId: IdSchema,
			producerItemInstanceId: IdSchema,
			productId: IdSchema,
			startedAtMs: NonNegativeIntegerSchema,
			completesAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("upgrade.started"),
			jobId: IdSchema,
			upgradeId: IdSchema,
			tierIndex: NonNegativeIntegerSchema,
			startedAtMs: NonNegativeIntegerSchema,
			completesAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("craft.started"),
			jobId: IdSchema,
			recipeId: IdSchema,
			startedAtMs: NonNegativeIntegerSchema,
			completesAtMs: NonNegativeIntegerSchema,
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
			type: z.literal("upgrade.completed"),
			jobId: IdSchema,
			upgradeId: IdSchema,
			tierIndex: NonNegativeIntegerSchema,
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
			type: z.literal("stash.opened"),
			stashId: IdSchema,
			stashItemInstanceId: IdSchema,
			openedAtMs: NonNegativeIntegerSchema,
			remainingCharges: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("stash.depleted"),
			stashId: IdSchema,
			stashItemInstanceId: IdSchema,
			depletedAtMs: NonNegativeIntegerSchema,
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
