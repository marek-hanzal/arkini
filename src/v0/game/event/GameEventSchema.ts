import { z } from "zod";
import { GameInstantMsSchema } from "~/v0/game/time/GameTimeSchema";
import { GamePlacementFailureReasonSchema } from "~/v0/game/placement/GamePlacementFailureReasonSchema";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().positive();

export const GameItemCreatedReasonSchema = z.enum([
	"producer-line-output",
	"producer-input-withdraw",
	"craft-input-withdraw",
	"inventory-placement",
	"board-stash",
	"tile-remove-output",
	"debug",
]);

const GameItemConsumedReasonSchema = z.enum([
	"producer-line-input",
	"producer-input-store",
	"producer-input-auto-fill",
	"craft-input",
	"craft-input-store",
	"craft-input-auto-fill",
	"inventory-placement",
	"board-stash",
	"remove-tool",
	"merge-source",
]);

const GameBoardItemChangeReasonSchema = z.enum([
	"producer-depleted",
	"tile-remove",
	"merge-result",
	"craft-result",
]);

const GameEventPlacementTargetSchema = z.discriminatedUnion("kind", [
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

const GameEventSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("item.created"),
			itemId: IdSchema,
			originItemInstanceId: IdSchema.optional(),
			reason: GameItemCreatedReasonSchema,
			spawnJobId: IdSchema.optional(),
			spawnSequenceIndex: NonNegativeIntegerSchema.optional(),
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
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("item.replaced"),
			fromItemId: IdSchema,
			itemInstanceId: IdSchema,
			reason: GameBoardItemChangeReasonSchema,
			atMs: GameInstantMsSchema,
			toItemId: IdSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("producer_input.stored"),
			producerItemInstanceId: IdSchema,
			lineId: IdSchema,
			itemId: IdSchema,
			quantity: PositiveIntegerSchema,
			previousQuantity: NonNegativeIntegerSchema,
			nextQuantity: PositiveIntegerSchema,
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("producer_input.withdrawn"),
			producerItemInstanceId: IdSchema,
			lineId: IdSchema,
			itemId: IdSchema,
			quantity: PositiveIntegerSchema,
			previousQuantity: PositiveIntegerSchema,
			nextQuantity: NonNegativeIntegerSchema,
			atMs: GameInstantMsSchema,
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
			atMs: GameInstantMsSchema,
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
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("producer_line.started"),
			atMs: GameInstantMsSchema,
			jobId: IdSchema,
			producerItemInstanceId: IdSchema,
			lineId: IdSchema,
			startAtMs: GameInstantMsSchema,
			readyAtMs: GameInstantMsSchema,
		})
		.strict(),

	z
		.object({
			type: z.literal("effect.activated"),
			atMs: GameInstantMsSchema,
			id: IdSchema,
			effectId: IdSchema,
			sourceItemInstanceId: IdSchema,
			startAtMs: GameInstantMsSchema,
			endAtMs: GameInstantMsSchema,
			producerJobId: IdSchema.optional(),
		})
		.strict(),
	z
		.object({
			type: z.literal("effect.expired"),
			id: IdSchema,
			effectId: IdSchema,
			sourceItemInstanceId: IdSchema,
			producerJobId: IdSchema.optional(),
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("craft.started"),
			atMs: GameInstantMsSchema,
			jobId: IdSchema,
			recipeId: IdSchema,
			targetItemInstanceId: IdSchema,
			startAtMs: GameInstantMsSchema,
			readyAtMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("producer_line.completed"),
			jobId: IdSchema,
			producerItemInstanceId: IdSchema,
			lineId: IdSchema,
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("producer_line.blocked"),
			jobId: IdSchema,
			producerItemInstanceId: IdSchema,
			lineId: IdSchema,
			reason: GamePlacementFailureReasonSchema,
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("producer_line.failed"),
			jobId: IdSchema,
			producerItemInstanceId: IdSchema,
			lineId: IdSchema,
			reason: GamePlacementFailureReasonSchema,
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("craft.completed"),
			jobId: IdSchema,
			recipeId: IdSchema,
			targetItemInstanceId: IdSchema,
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("craft.blocked"),
			jobId: IdSchema,
			recipeId: IdSchema,
			targetItemInstanceId: IdSchema,
			reason: GamePlacementFailureReasonSchema,
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("craft.failed"),
			jobId: IdSchema,
			recipeId: IdSchema,
			targetItemInstanceId: IdSchema,
			reason: GamePlacementFailureReasonSchema,
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("item.spawn.blocked"),
			jobId: IdSchema,
			itemId: IdSchema,
			reason: GamePlacementFailureReasonSchema,
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("item.spawn.failed"),
			jobId: IdSchema,
			itemId: IdSchema,
			reason: GamePlacementFailureReasonSchema,
			atMs: GameInstantMsSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("producer.line.default_changed"),
			producerItemInstanceId: IdSchema,
			previousLineId: IdSchema.optional(),
			nextLineId: IdSchema.optional(),
			atMs: GameInstantMsSchema,
		})
		.strict(),
]);

export type GameEvent = z.infer<typeof GameEventSchema>;
