import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { PositionSchema } from "~/item-location/schema/PositionSchema";
import { ToolbarSizeSchema } from "~/item-location/schema/ToolbarSizeSchema";
import { BoardItemSchema } from "~/game-start/schema/BoardItemSchema";
import { InventoryItemSchema } from "~/game-start/schema/InventoryItemSchema";
import { ToolbarItemSchema } from "~/game-start/schema/ToolbarItemSchema";

export const ProjectAvatarKeys = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
] as const;

const ProjectStartBoardItemSchema = BoardItemSchema.extend({
	quantity: PositiveIntegerSchema,
});
const ProjectStartToolbarItemSchema = ToolbarItemSchema.extend({
	quantity: PositiveIntegerSchema,
});
const ProjectStartInventoryItemSchema = InventoryItemSchema.extend({
	position: PositionSchema,
	quantity: PositiveIntegerSchema,
});

export const ProjectFormBaseSchema = z
	.object({
		title: TitleSchema,
		hero: IdSchema,
		avatars: z.array(IdSchema).max(ProjectAvatarKeys.length),
		board: SizeSchema,
		inventory: SizeSchema,
		toolbarSize: ToolbarSizeSchema,
		start: z
			.object({
				currentSpace: NonNegativeIntegerSchema,
				board: z.array(ProjectStartBoardItemSchema),
				inventory: z.array(ProjectStartInventoryItemSchema),
				toolbar: z.array(ProjectStartToolbarItemSchema),
			})
			.strict(),
	})
	.strict();

export namespace ProjectFormSchema {
	export type Type = z.infer<typeof ProjectFormBaseSchema>;
}
