import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { TitleSchema } from "~/engine/common/schema/TitleSchema";
import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { PositionSchema } from "~/item-location/schema/PositionSchema";
import { ToolbarSizeSchema } from "~/item-location/schema/ToolbarSizeSchema";
import { BoardItemSchema } from "~/game-start/BoardItemSchema";
import { InventoryItemSchema } from "~/game-start/InventoryItemSchema";
import { ToolbarItemSchema } from "~/game-start/ToolbarItemSchema";

export const EditorProjectAvatarKeys = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
] as const;

const EditorProjectStartBoardItemSchema = BoardItemSchema.extend({
	quantity: PositiveIntegerSchema,
});
const EditorProjectStartToolbarItemSchema = ToolbarItemSchema.extend({
	quantity: PositiveIntegerSchema,
});
const EditorProjectStartInventoryItemSchema = InventoryItemSchema.extend({
	position: PositionSchema,
	quantity: PositiveIntegerSchema,
});

export const EditorProjectFormBaseSchema = z
	.object({
		title: TitleSchema,
		hero: IdSchema,
		avatars: z.array(IdSchema).max(EditorProjectAvatarKeys.length),
		board: SizeSchema,
		inventory: SizeSchema,
		toolbarSize: ToolbarSizeSchema,
		start: z
			.object({
				currentSpace: NonNegativeIntegerSchema,
				board: z.array(EditorProjectStartBoardItemSchema),
				inventory: z.array(EditorProjectStartInventoryItemSchema),
				toolbar: z.array(EditorProjectStartToolbarItemSchema),
			})
			.strict(),
	})
	.strict();

export namespace EditorProjectFormSchema {
	export type Type = z.infer<typeof EditorProjectFormBaseSchema>;
}
