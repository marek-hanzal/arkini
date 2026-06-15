import { z } from "zod";
import { BoardCellSchema } from "~/v0/board/schema/BoardCellSchema";
import { InventorySlotIndexSchema } from "~/v0/inventory/schema/InventorySlotIndexSchema";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";
import { ItemLocationKindSchema } from "./ItemLocationKindSchema";

export const ItemLocationSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal(ItemLocationKindSchema.enum.board),
		x: BoardCellSchema.shape.x,
		y: BoardCellSchema.shape.y,
	}),
	z.object({
		kind: z.literal(ItemLocationKindSchema.enum.inventory),
		slotIndex: InventorySlotIndexSchema,
	}),
	z.object({
		kind: z.literal(ItemLocationKindSchema.enum["activation-input"]),
		ownerItemInstanceId: z.string().min(1),
		itemId: GameItemIdSchema,
	}),
	z.object({
		kind: z.literal(ItemLocationKindSchema.enum["craft-input"]),
		ownerItemInstanceId: z.string().min(1),
		itemId: GameItemIdSchema,
	}),
]);

type ItemLocationSchema = typeof ItemLocationSchema;
export namespace ItemLocationSchema {
	export type Type = z.infer<ItemLocationSchema>;
}
