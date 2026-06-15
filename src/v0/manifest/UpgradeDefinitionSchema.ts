import { z } from "zod";
import { GameItemIdSchema } from "./GameItemIdSchema";
import { GameLootTableIdSchema } from "./GameLootTableIdSchema";
import { GameUpgradeIdSchema } from "./GameUpgradeIdSchema";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";

const UpgradeCostDefinitionSchema = z.object({
	itemId: GameItemIdSchema,
	quantity: PositiveIntegerSchema,
});

const UpgradeEffectDefinitionSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("producer.cooldown.add"),
		itemId: GameItemIdSchema,
		ms: z.number().int(),
	}),
	z.object({
		type: z.literal("producer.outputTable.set"),
		itemId: GameItemIdSchema,
		tableId: GameLootTableIdSchema,
	}),
]);

const UpgradeTierDefinitionSchema = z.object({
	cost: z.array(UpgradeCostDefinitionSchema),
	durationMs: NonNegativeIntegerSchema,
	effects: z.array(UpgradeEffectDefinitionSchema),
});

export const UpgradeDefinitionSchema = z.object({
	id: GameUpgradeIdSchema,
	code: z.string().min(1),
	name: z.string().min(1),
	description: z.string(),
	sort: NonNegativeIntegerSchema,
	tiers: z.array(UpgradeTierDefinitionSchema).min(1),
});

type UpgradeDefinitionSchema = typeof UpgradeDefinitionSchema;
export namespace UpgradeDefinitionSchema {
	export type Type = z.infer<UpgradeDefinitionSchema>;
}
