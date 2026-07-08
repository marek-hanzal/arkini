import { z } from "zod";
import { PositiveIntegerSchema } from "~/config/schema/GameConfigScalarSchemas";
import {
	AuthoringDomainSelectorSchema,
	ResolvedDomainSelectorSchema,
} from "~/config/schema/GameDomainSelectorSchema";

export const GameEffectSourceScopeSchema = z.enum([
	"board",
	"inventory",
	"both",
]);
export const GameEffectPolaritySchema = z.enum([
	"buff",
	"debuff",
	"neutral",
	"mixed",
]);

export const GameLineEffectDisplaySchema = z
	.enum([
		"always",
		"whenActive",
		"whenMissing",
		"never",
	])
	.default("whenActive");

const GameLineEffectPhaseSchema = z
	.enum([
		"visibility",
		"start",
	])
	.default("start");

const GameNearbyCapacitySelectionSchema = z
	.enum([
		"nearest",
	])
	.default("nearest");

const DurationMultiplierSchema = z
	.number()
	.min(0)
	.refine((value) => value !== 1, {
		message: "Duration multiplier must change timing; 1 is a no-op.",
	});

export const GameNearbyDistanceSchema = z.enum([
	"neighbour",
	"near",
	"any",
]);

export const GameLineEffectNearbyDistanceMultiplierSchema = z
	.object({
		distance: GameNearbyDistanceSchema,
		multiplier: z.number().min(0),
	})
	.strict();

export const GameNearbyItemSelectorSchema = z
	.object({
		items: ResolvedDomainSelectorSchema,
	})
	.strict();

export const GameNearbyItemAuthoringSelectorSchema = z
	.object({
		items: AuthoringDomainSelectorSchema,
	})
	.strict();

export const createGameLineEffectMemberSchemas = <
	TItemSelectorSchema extends
		| typeof GameNearbyItemSelectorSchema
		| typeof GameNearbyItemAuthoringSelectorSchema,
>(
	itemSelectorSchema: TItemSelectorSchema,
) =>
	[
		z
			.object({
				kind: z.literal("grant.require"),
				selector: ResolvedDomainSelectorSchema,
				phase: GameLineEffectPhaseSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.blockStart"),
				selector: ResolvedDomainSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("nearby.require"),
				...itemSelectorSchema.shape,
				distance: GameNearbyDistanceSchema,
				phase: GameLineEffectPhaseSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("nearby.capacity.spend"),
				...itemSelectorSchema.shape,
				distance: GameNearbyDistanceSchema,
				amount: PositiveIntegerSchema.default(1),
				selection: GameNearbyCapacitySelectionSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("nearby.duration.multiply"),
				...itemSelectorSchema.shape,
				bands: z.array(GameLineEffectNearbyDistanceMultiplierSchema).min(1),
				maxSources: PositiveIntegerSchema.optional(),
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.duration.multiply"),
				selector: ResolvedDomainSelectorSchema,
				multiplier: DurationMultiplierSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
	] as const;

const createGameLineEffectSchema = <
	TItemSelectorSchema extends
		| typeof GameNearbyItemSelectorSchema
		| typeof GameNearbyItemAuthoringSelectorSchema,
>(
	itemSelectorSchema: TItemSelectorSchema,
) => z.discriminatedUnion("kind", createGameLineEffectMemberSchemas(itemSelectorSchema));

export const GameLineEffectSchema = createGameLineEffectSchema(GameNearbyItemSelectorSchema);
export const GameLineEffectAuthoringSchema = createGameLineEffectSchema(
	GameNearbyItemAuthoringSelectorSchema,
);
