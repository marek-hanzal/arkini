import { z } from "zod";
import {
	NonNegativeIntegerSchema,
	PositiveNumberSchema,
	PositiveProbabilitySchema,
	QuantitySchema,
} from "~/config/schema/GameConfigScalarSchemas";
import { GameGrantSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import {
	DurationMultiplierSchema,
	GameLineEffectDisplaySchema,
	GameLineEffectDistanceBandSchema,
	GameLineEffectPhaseSchema,
	GameNearbyItemAuthoringSelectorSchema,
	GameNearbyItemSelectorSchema,
} from "~/config/schema/GameLineEffectSchema";

const createGameNearbyLootChanceSourceSchema = <
	TItemSelectorSchema extends
		| typeof GameNearbyItemSelectorSchema
		| typeof GameNearbyItemAuthoringSelectorSchema,
>(
	itemSelectorSchema: TItemSelectorSchema,
) =>
	z
		.object({
			...itemSelectorSchema.shape,
			chance: PositiveNumberSchema,
			label: z.string().min(1).optional(),
		})
		.strict();

const createGameDropEffectSchema = <
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
				maxSources: z.number().int().positive().optional(),
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
		z
			.object({
				kind: z.literal("grant.drop.hide"),
				selector: GameGrantSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.drop.show"),
				selector: GameGrantSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.drop.disable"),
				selector: GameGrantSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.drop.enable"),
				selector: GameGrantSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.loot.extraOutputChance.add"),
				selector: GameGrantSelectorSchema,
				chance: PositiveProbabilitySchema,
				quantity: QuantitySchema.default(1),
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("nearby.loot.outputChance.add"),
				radius: NonNegativeIntegerSchema,
				sources: z.array(createGameNearbyLootChanceSourceSchema(itemSelectorSchema)).min(1),
				quantity: QuantitySchema.default(1),
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
	]);

export const GameDropEffectSchema = createGameDropEffectSchema(GameNearbyItemSelectorSchema);
export const GameDropEffectAuthoringSchema = createGameDropEffectSchema(
	GameNearbyItemAuthoringSelectorSchema,
);
