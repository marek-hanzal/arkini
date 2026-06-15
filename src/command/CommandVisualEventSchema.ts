import { z } from "zod";
import { ActivationDepletionSchema } from "~/activation/type/ActivationDepletionSchema";
import { ActivationModeSchema } from "~/activation/type/ActivationModeSchema";
import { ItemInstanceIdSchema } from "~/item-instance/type/ItemInstanceIdSchema";
import { ItemLocationSchema } from "~/item-instance/type/ItemLocationSchema";
import { GameItemIdSchema } from "~/manifest/GameItemIdSchema";
import { GameUpgradeIdSchema } from "~/manifest/GameUpgradeIdSchema";
import { PositiveIntegerSchema } from "~/manifest/PositiveIntegerSchema";

export const CommandVisualEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("item.moved"),
		itemInstanceId: ItemInstanceIdSchema,
		itemId: GameItemIdSchema,
		from: ItemLocationSchema,
		to: ItemLocationSchema,
	}),
	z.object({
		type: z.literal("item.swapped"),
		sourceItemInstanceId: ItemInstanceIdSchema,
		sourceItemId: GameItemIdSchema,
		sourceFrom: ItemLocationSchema,
		sourceTo: ItemLocationSchema,
		targetItemInstanceId: ItemInstanceIdSchema,
		targetItemId: GameItemIdSchema,
		targetFrom: ItemLocationSchema,
		targetTo: ItemLocationSchema,
	}),
	z.object({
		type: z.literal("item.merged"),
		sourceItemInstanceId: ItemInstanceIdSchema,
		sourceItemId: GameItemIdSchema,
		targetItemInstanceId: ItemInstanceIdSchema,
		targetItemId: GameItemIdSchema,
		resultItemId: GameItemIdSchema,
		consumeSource: z.boolean(),
	}),
	z.object({
		type: z.literal("item.fed"),
		sourceItemInstanceId: ItemInstanceIdSchema,
		targetItemInstanceId: ItemInstanceIdSchema,
		itemId: GameItemIdSchema,
	}),
	z.object({
		type: z.literal("item.spawned"),
		itemInstanceId: ItemInstanceIdSchema.optional(),
		itemId: GameItemIdSchema,
		originItemInstanceId: ItemInstanceIdSchema.optional(),
		to: ItemLocationSchema,
		reason: z.enum([
			"activation-output",
			"activation-withdrawal",
			"inventory-placement",
		]),
	}),
	z.object({
		type: z.literal("item.consumed"),
		itemInstanceId: ItemInstanceIdSchema,
		itemId: GameItemIdSchema,
		from: ItemLocationSchema.optional(),
		reason: z.enum([
			"merge",
			"craft-input",
			"activation-input",
			"upgrade-cost",
			"inventory-stack",
		]),
	}),
	z.object({
		type: z.literal("activation.activated"),
		itemInstanceId: ItemInstanceIdSchema,
		mode: ActivationModeSchema,
	}),
	z.object({
		type: z.literal("activation.depleted"),
		itemInstanceId: ItemInstanceIdSchema,
		depletion: ActivationDepletionSchema,
	}),
	z.object({
		type: z.literal("inventory.stacked"),
		sourceItemInstanceId: ItemInstanceIdSchema,
		targetItemInstanceId: ItemInstanceIdSchema,
		itemId: GameItemIdSchema,
		quantity: PositiveIntegerSchema,
	}),
	z.object({
		type: z.literal("upgrade.started"),
		upgradeId: GameUpgradeIdSchema,
		targetLevel: PositiveIntegerSchema,
	}),
]);

type CommandVisualEventSchema = typeof CommandVisualEventSchema;
export namespace CommandVisualEventSchema {
	export type Type = z.infer<CommandVisualEventSchema>;
}
