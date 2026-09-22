import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { BoardItemSchema } from "~/game-start/schema/BoardItemSchema";

export const ProjectAvatarKeys = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
] as const;

export const EditorProjectSizeMax = 42;

const EditorProjectSizeSchema = SizeSchema.extend({
	height: SizeSchema.shape.height.max(EditorProjectSizeMax),
	width: SizeSchema.shape.width.max(EditorProjectSizeMax),
});

export const ProjectFormBaseSchema = z
	.object({
		title: TitleSchema,
		introduction: z.string(),
		hero: IdSchema,
		avatars: z.array(IdSchema).max(ProjectAvatarKeys.length),
		board: EditorProjectSizeSchema,
		start: z
			.object({
				currentSpace: NonNegativeIntegerSchema,
				board: z.array(BoardItemSchema),
			})
			.strict(),
	})
	.strict();

export namespace ProjectFormSchema {
	export type Type = z.infer<typeof ProjectFormBaseSchema>;
}
