import { z } from "zod";
import { GamePlacementFailureReasonSchema } from "~/v0/game/engine/model/GamePlacementFailureReasonSchema";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();

export const GameItemCreatedReasonSchema = z.enum([
	"product-output",
	"stash-output",
	"stored-requirement-withdraw",
	"producer-input-withdraw",
	"craft-input-withdraw",
	"inventory-placement",
	"board-stash",
	"debug",
]);

export const GameItemConsumedReasonSchema = z.enum([
	"product-input",
	"producer-input-store",
	"stash-input",
	"craft-input",
	"craft-input-store",
	"craft-requirement",
	"stored-requirement-store",
	"inventory-placement",
	"board-stash",
	"remove-tool",
	"merge-source",
	"upgrade-cost",
]);

export const GameBoardItemChangeReasonSchema = z.enum([
	"stash-depleted",
	"tile-remove",
	"merge-result",
	"craft-result",
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
			type: z.literal("producer_input.stored"),
			producerItemInstanceId: IdSchema,
			productId: IdSchema,
			itemId: IdSchema,
			quantity: PositiveIntegerSchema,
			previousQuantity: NonNegativeIntegerSchema,
			nextQuantity: PositiveIntegerSchema,
			storedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("producer_input.withdrawn"),
			producerItemInstanceId: IdSchema,
			productId: IdSchema,
			itemId: IdSchema,
			quantity: PositiveIntegerSchema,
			previousQuantity: PositiveIntegerSchema,
			nextQuantity: NonNegativeIntegerSchema,
			withdrawnAtMs: NonNegativeIntegerSchema,
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
			type: z.literal("craft_input.stored"),
			targetItemInstanceId: IdSchema,
			recipeId: IdSchema,
			itemId: IdSchema,
			quantity: PositiveIntegerSchema,
			previousQuantity: NonNegativeIntegerSchema,
			nextQuantity: PositiveIntegerSchema,
			storedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("craft_input.withdrawn"),
			targetItemInstanceId: IdSchema,
			recipeId: IdSchema,
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
			type: z.literal("producer.product_line.enabled_changed"),
			producerItemInstanceId: IdSchema,
			productId: IdSchema,
			previousEnabled: z.boolean(),
			nextEnabled: z.boolean(),
			changedAtMs: NonNegativeIntegerSchema,
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
			targetItemInstanceId: IdSchema,
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
			reason: GamePlacementFailureReasonSchema,
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
			targetItemInstanceId: IdSchema,
			completedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("item.spawn.blocked"),
			scheduledEventId: IdSchema,
			itemId: IdSchema,
			reason: GamePlacementFailureReasonSchema,
			blockedAtMs: NonNegativeIntegerSchema,
		})
		.strict(),
]);

export type GameEventPlacementTarget = z.infer<typeof GameEventPlacementTargetSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;
