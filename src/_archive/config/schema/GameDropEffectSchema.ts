import { z } from "zod";
import {
	PositiveNumberSchema,
	PositiveProbabilitySchema,
	QuantitySchema,
} from "~/config/schema/GameConfigScalarSchemas";
import { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import {
	createGameLineEffectMemberSchemas,
	GameLineEffectDisplaySchema,
	GameNearbyDistanceSchema,
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

const createGameDropOnlyEffectMemberSchemas = <
	TItemSelectorSchema extends
		| typeof GameNearbyItemSelectorSchema
		| typeof GameNearbyItemAuthoringSelectorSchema,
>(
	itemSelectorSchema: TItemSelectorSchema,
) =>
	[
		z
			.object({
				kind: z.literal("grant.drop.hide"),
				selector: ResolvedDomainSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.drop.show"),
				selector: ResolvedDomainSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.drop.disable"),
				selector: ResolvedDomainSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.drop.enable"),
				selector: ResolvedDomainSelectorSchema,
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
				reason: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("grant.loot.extraOutputChance.add"),
				selector: ResolvedDomainSelectorSchema,
				chance: PositiveProbabilitySchema,
				quantity: QuantitySchema.default(1),
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
		z
			.object({
				kind: z.literal("nearby.loot.outputChance.add"),
				distance: GameNearbyDistanceSchema,
				sources: z.array(createGameNearbyLootChanceSourceSchema(itemSelectorSchema)).min(1),
				quantity: QuantitySchema.default(1),
				display: GameLineEffectDisplaySchema,
				label: z.string().min(1).optional(),
			})
			.strict(),
	] as const;

const createGameDropEffectSchema = <
	TItemSelectorSchema extends
		| typeof GameNearbyItemSelectorSchema
		| typeof GameNearbyItemAuthoringSelectorSchema,
>(
	itemSelectorSchema: TItemSelectorSchema,
) =>
	z.discriminatedUnion("kind", [
		...createGameLineEffectMemberSchemas(itemSelectorSchema),
		...createGameDropOnlyEffectMemberSchemas(itemSelectorSchema),
	]);

export const GameDropEffectSchema = createGameDropEffectSchema(GameNearbyItemSelectorSchema);
export const GameDropEffectAuthoringSchema = createGameDropEffectSchema(
	GameNearbyItemAuthoringSelectorSchema,
);
