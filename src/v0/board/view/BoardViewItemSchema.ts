import { z } from "zod";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";
import { ActivationViewSchema } from "./ActivationViewSchema";
import { BoardItemStateSchema } from "./BoardItemStateSchema";
import { CraftProgressViewSchema } from "./CraftProgressViewSchema";
import { ViewMotionSchema } from "~/v0/play/motion/ViewMotionSchema";

export const BoardViewItemSchema = z.object({
	id: z.string().min(1),
	itemId: GameItemIdSchema,
	x: z.number().int().nonnegative(),
	y: z.number().int().nonnegative(),
	state: BoardItemStateSchema,
	activation: ActivationViewSchema.optional(),
	craft: CraftProgressViewSchema.optional(),
	motion: ViewMotionSchema.optional(),
});

type BoardViewItemSchema = typeof BoardViewItemSchema;
export namespace BoardViewItemSchema {
	export type Type = z.infer<BoardViewItemSchema>;
}

export type BoardViewItem = BoardViewItemSchema.Type;
