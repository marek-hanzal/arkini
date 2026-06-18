import { z } from "zod";
import { ActionVisualAnimationSchema } from "~/v0/play/action/ActionVisualAnimationSchema";
import { ActivationDepletionSchema } from "~/v0/activation/type/ActivationDepletionSchema";
import { ActivationModeSchema } from "~/v0/activation/type/ActivationModeSchema";
import { ItemInstanceIdSchema } from "~/v0/item-instance/type/ItemInstanceIdSchema";
import { ItemLocationSchema } from "~/v0/item-instance/type/ItemLocationSchema";
import { InventorySlotIndexSchema } from "~/v0/inventory/schema/InventorySlotIndexSchema";
import { GameCraftRecipeIdSchema } from "~/v0/manifest/GameCraftRecipeIdSchema";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";
import { GameUpgradeIdSchema } from "~/v0/manifest/GameUpgradeIdSchema";
import { PositiveIntegerSchema } from "~/v0/manifest/PositiveIntegerSchema";

const NonNegativeIntegerSchema = z.number().int().min(0);

const optionalAnimationShape = {
	animation: ActionVisualAnimationSchema.optional(),
};

const requiredAnimationShape = {
	animation: ActionVisualAnimationSchema,
};

const actionVisualEvent = <TShape extends z.ZodRawShape>(shape: TShape) =>
	z.object({
		...shape,
		...optionalAnimationShape,
	});

const animatedActionVisualEvent = <TShape extends z.ZodRawShape>(shape: TShape) =>
	z.object({
		...shape,
		...requiredAnimationShape,
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
	animatedActionVisualEvent({
		type: z.literal("item.merged"),
		sourceItemInstanceId: ItemInstanceIdSchema,
		sourceItemId: GameItemIdSchema,
		targetItemInstanceId: ItemInstanceIdSchema,
		targetItemId: GameItemIdSchema,
		resultItemId: GameItemIdSchema,
		consumeSource: z.boolean(),
	}),

	actionVisualEvent({
		type: z.literal("item.replaced"),
		itemInstanceId: ItemInstanceIdSchema,
		fromItemId: GameItemIdSchema,
		toItemId: GameItemIdSchema,
		reason: z.enum([
			"merge-result",
			"craft-result",
			"stash-depleted",
			"tile-remove",
		]),
	}),
	actionVisualEvent({
		type: z.literal("item.fed"),
		sourceItemInstanceId: ItemInstanceIdSchema,
		targetItemInstanceId: ItemInstanceIdSchema,
		itemId: GameItemIdSchema,
	}),
	animatedActionVisualEvent({
		type: z.literal("item.spawned"),
		itemInstanceId: ItemInstanceIdSchema.optional(),
		itemId: GameItemIdSchema,
		from: ItemLocationSchema.optional(),
		originItemInstanceId: ItemInstanceIdSchema.optional(),
		to: ItemLocationSchema,
		reason: z.enum([
			"activation-output",
			"activation-withdrawal",
			"board-stash",
			"debug",
			"inventory-placement",
			"product-output",
			"stash-output",
			"stored-requirement-withdraw",
			"craft-input-withdraw",
		]),
	}),
	actionVisualEvent({
		type: z.literal("item.consumed"),
		itemInstanceId: ItemInstanceIdSchema,
		itemId: GameItemIdSchema,
		from: ItemLocationSchema.optional(),
		reason: z.enum([
			"activation-input",
			"board-stash",
			"craft-input",
			"craft-input-store",
			"craft-requirement",
			"inventory-placement",
			"inventory-stack",
			"merge",
			"merge-result",
			"merge-source",
			"product-input",
			"remove-tool",
			"stash-depleted",
			"stash-input",
			"stored-requirement-store",
			"tile-remove",
			"upgrade-cost",
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
		type: z.literal("inventory.quantity_changed"),
		itemId: GameItemIdSchema,
		slotIndex: InventorySlotIndexSchema,
		quantity: PositiveIntegerSchema,
		previousQuantity: NonNegativeIntegerSchema,
		nextQuantity: NonNegativeIntegerSchema,
		reason: z.enum([
			"activation-input",
			"board-stash",
			"craft-input",
			"craft-input-store",
			"craft-requirement",
			"debug",
			"inventory-placement",
			"inventory-stack",
			"merge",
			"merge-result",
			"merge-source",
			"product-input",
			"product-output",
			"stash-input",
			"stash-output",
			"remove-tool",
			"stash-depleted",
			"stored-requirement-store",
			"stored-requirement-withdraw",
			"craft-input-store",
			"craft-input-withdraw",
			"tile-remove",
			"upgrade-cost",
		]),
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
