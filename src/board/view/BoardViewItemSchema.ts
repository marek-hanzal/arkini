import { z } from "zod";
import { IdSchema } from "~/config/IdSchema";
import { ActivationViewSchema } from "./ActivationViewSchema";
import { BoardItemStateSchema } from "./BoardItemStateSchema";
import { CraftProgressViewSchema } from "./CraftProgressViewSchema";

export const BoardViewItemSchema = z.object({
	id: z.string().min(1),
	itemId: IdSchema,
	quantity: z.number().int().positive().optional(),
	x: z.number().int().nonnegative(),
	y: z.number().int().nonnegative(),
	state: BoardItemStateSchema,
	activation: ActivationViewSchema.optional(),
	capacity: z
		.object({
			max: z.number().int().positive(),
			remaining: z.number().int().nonnegative(),
		})
		.optional(),
	craft: CraftProgressViewSchema.optional(),
});

type BoardViewItemSchema = typeof BoardViewItemSchema;
export namespace BoardViewItemSchema {
	export type Type = z.infer<BoardViewItemSchema>;
}

export type BoardViewItem = BoardViewItemSchema.Type;
