import { z } from "zod";
import { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import { ActivationDepletionSchema } from "~/v0/activation/type/ActivationDepletionSchema";
import { ActivationModeSchema } from "~/v0/activation/type/ActivationModeSchema";
import { ItemInstanceIdSchema } from "~/v0/item-instance/type/ItemInstanceIdSchema";
import { ItemLocationSchema } from "~/v0/item-instance/type/ItemLocationSchema";
import { GameCraftRecipeIdSchema } from "~/v0/manifest/GameCraftRecipeIdSchema";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";
import { GameUpgradeIdSchema } from "~/v0/manifest/GameUpgradeIdSchema";
import { PositiveIntegerSchema } from "~/v0/manifest/PositiveIntegerSchema";

const animationShape = {
	animation: ActionVisualAnimationSchema.optional(),
};

const actionVisualEvent = <TShape extends z.ZodRawShape>(shape: TShape) =>
	z.object({
		...shape,
		...animationShape,
	});

export const ActionVisualEventSchema = z.discriminatedUnion("type", [
	actionVisualEvent({
		type: z.literal("item.moved"),
		itemInstanceId: ItemInstanceIdSchema,
		itemId: GameItemIdSchema,
		from: ItemLocationSchema,
		to: ItemLocationSchema,
	}),
	actionVisualEvent({
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
	actionVisualEvent({
		type: z.literal("item.merged"),
		sourceItemInstanceId: ItemInstanceIdSchema,
		sourceItemId: GameItemIdSchema,
		targetItemInstanceId: ItemInstanceIdSchema,
		targetItemId: GameItemIdSchema,
		resultItemId: GameItemIdSchema,
		consumeSource: z.boolean(),
	}),
	actionVisualEvent({
		type: z.literal("item.fed"),
		sourceItemInstanceId: ItemInstanceIdSchema,
		targetItemInstanceId: ItemInstanceIdSchema,
		itemId: GameItemIdSchema,
	}),
	actionVisualEvent({
		type: z.literal("item.spawned"),
		itemInstanceId: ItemInstanceIdSchema.optional(),
		itemId: GameItemIdSchema,
		from: ItemLocationSchema.optional(),
		originItemInstanceId: ItemInstanceIdSchema.optional(),
		to: ItemLocationSchema,
		reason: z.enum([
			"activation-output",
			"activation-withdrawal",
			"inventory-placement",
		]),
	}),
	actionVisualEvent({
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
	actionVisualEvent({
		type: z.literal("activation.activated"),
		itemInstanceId: ItemInstanceIdSchema,
		mode: ActivationModeSchema,
	}),
	actionVisualEvent({
		type: z.literal("activation.depleted"),
		itemInstanceId: ItemInstanceIdSchema,
		depletion: ActivationDepletionSchema,
	}),
	actionVisualEvent({
		type: z.literal("inventory.stacked"),
		sourceItemInstanceId: ItemInstanceIdSchema,
		targetItemInstanceId: ItemInstanceIdSchema,
		itemId: GameItemIdSchema,
		quantity: PositiveIntegerSchema,
	}),
	actionVisualEvent({
		type: z.literal("craft.started"),
		itemInstanceId: ItemInstanceIdSchema,
		recipeId: GameCraftRecipeIdSchema,
		resultItemId: GameItemIdSchema,
		readyAtMs: z.number().optional(),
	}),
	actionVisualEvent({
		type: z.literal("craft.claimed"),
		itemInstanceId: ItemInstanceIdSchema,
		recipeId: GameCraftRecipeIdSchema,
		sourceItemId: GameItemIdSchema,
		resultItemId: GameItemIdSchema,
	}),
	actionVisualEvent({
		type: z.literal("upgrade.started"),
		upgradeId: GameUpgradeIdSchema,
		targetLevel: PositiveIntegerSchema,
	}),
]);

type ActionVisualEventSchema = typeof ActionVisualEventSchema;
export namespace ActionVisualEventSchema {
	export type Type = z.infer<ActionVisualEventSchema>;
}
