import { z } from "zod";
import { GameConfig } from "~/manifest/data/GameConfig";
import { ItemIdSchema } from "~/manifest/data/ItemIdSchema";
import { PositiveIntegerSchema } from "~/manifest/data/PositiveIntegerSchema";

export const BoardCoordinateSchema = z.number().int().min(0);
export const BoardCellSchema = z.object({
	x: BoardCoordinateSchema.max(GameConfig.game.board.width - 1),
	y: BoardCoordinateSchema.max(GameConfig.game.board.height - 1),
});
export const InventorySlotIndexSchema = z
	.number()
	.int()
	.min(0)
	.max(GameConfig.game.inventory.slots - 1);
export const BoardItemIdSchema = z.string().min(1);
export const GameActionActivationSchema = z.enum([
	"single",
	"exhaust",
]);

export const SaveRowSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	boardWidth: z.literal(GameConfig.game.board.width),
	boardHeight: z.literal(GameConfig.game.board.height),
	inventorySlots: z.literal(GameConfig.game.inventory.slots),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

export const BoardItemRowSchema = z.object({
	id: BoardItemIdSchema,
	saveGameId: z.string().min(1),
	itemDefinitionId: ItemIdSchema,
	x: BoardCellSchema.shape.x,
	y: BoardCellSchema.shape.y,
	stateJson: z.string(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

export const InventoryStackRowSchema = z.object({
	id: z.string().min(1),
	saveGameId: z.string().min(1),
	slotIndex: InventorySlotIndexSchema,
	itemDefinitionId: ItemIdSchema,
	quantity: PositiveIntegerSchema,
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

export const PlaceInventoryItemInputSchema = z.object({
	slotIndex: InventorySlotIndexSchema,
	...BoardCellSchema.shape,
});
export const SwapInventorySlotsInputSchema = z.object({
	sourceSlotIndex: InventorySlotIndexSchema,
	targetSlotIndex: InventorySlotIndexSchema,
});
export const StashBoardItemInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	slotIndex: InventorySlotIndexSchema.optional(),
});
export const MoveBoardItemInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	...BoardCellSchema.shape,
});
export const SwapBoardItemsInputSchema = z.object({
	sourceBoardItemId: BoardItemIdSchema,
	targetBoardItemId: BoardItemIdSchema,
});
export const MergeBoardItemsInputSchema = z.object({
	sourceBoardItemId: BoardItemIdSchema,
	targetBoardItemId: BoardItemIdSchema,
});
export const ProduceBoardItemInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	activation: GameActionActivationSchema.default("single"),
});
export const BuildRecipeInputSchema = z.object({
	recipeId: z.string().startsWith("build:"),
	...BoardCellSchema.shape,
});
