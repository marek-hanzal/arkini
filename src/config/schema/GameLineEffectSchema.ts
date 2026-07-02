import { z } from "zod";
import {
	NonNegativeIntegerSchema,
	PositiveIntegerSchema,
} from "~/config/schema/GameConfigScalarSchemas";
import {
	AuthoringDomainSelectorSchema,
	GameGrantSelectorSchema,
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

export const GameLineEffectPhaseSchema = z
	.enum([
		"visibility",
		"start",
	])
	.default("start");

export const DurationMultiplierSchema = z
	.number()
	.min(0)
	.refine((value) => value !== 1, {
		message: "Duration multiplier must change timing; 1 is a no-op.",
	});

export const GameLineEffectDistanceBandSchema = z
	.object({
		minDistance: NonNegativeIntegerSchema.default(0),
		maxDistance: NonNegativeIntegerSchema.optional(),
		multiplier: z.number().min(0),
	})
	.strict()
	.refine((value) => value.maxDistance === undefined || value.maxDistance >= value.minDistance, {
		message: "maxDistance must be >= minDistance",
	});

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

const createGameLineEffectSchema = <
	TItemSelectorSchema extends
		| typeof GameNearbyItemSelectorSchema
		| typeof GameNearbyItemAuthoringSelectorSchema,
>(
	itemSelectorSchema: TItemSelectorSchema,
) =>
	z.discriminatedUnion("kind", [
		z
			.object({
				kind: z.literal("grant.require"),
				selector: GameGrantSelectorSchema,
				phase: GameLineEffectPhaseSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.blockStart"),
				selector: GameGrantSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("nearby.require"),
				...itemSelectorSchema.shape,
				radius: NonNegativeIntegerSchema,
				phase: GameLineEffectPhaseSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("nearby.duration.multiply"),
				...itemSelectorSchema.shape,
				radius: NonNegativeIntegerSchema,
				bands: z.array(GameLineEffectDistanceBandSchema).min(1),
				maxSources: PositiveIntegerSchema.optional(),
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.duration.multiply"),
				selector: GameGrantSelectorSchema,
				multiplier: DurationMultiplierSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
	]);

export const GameLineEffectSchema = createGameLineEffectSchema(GameNearbyItemSelectorSchema);
export const GameLineEffectAuthoringSchema = createGameLineEffectSchema(
	GameNearbyItemAuthoringSelectorSchema,
);
