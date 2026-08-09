import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TitleSchema } from "~/engine/common/schema/TitleSchema";
import { GridSizeSchema } from "~/engine/grid/schema/GridSizeSchema";
import { ToolbarSizeSchema } from "~/engine/meta/schema/ToolbarSizeSchema";

export const EditorProjectAvatarKeys = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
] as const;

export const EditorProjectFormBaseSchema = z
	.object({
		title: TitleSchema,
		hero: IdSchema,
		avatars: z.array(IdSchema).max(EditorProjectAvatarKeys.length),
		board: GridSizeSchema,
		inventory: GridSizeSchema,
		toolbarSize: ToolbarSizeSchema,
	})
	.strict();

export namespace EditorProjectFormSchema {
	export type Type = z.infer<typeof EditorProjectFormBaseSchema>;
}
