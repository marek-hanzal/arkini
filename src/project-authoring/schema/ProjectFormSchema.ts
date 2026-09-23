import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { StartSchema } from "~/game-start/schema/StartSchema";
import { TemplateSchema } from "~/board-template/schema/TemplateSchema";

export const ProjectAvatarKeys = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
	"avatar-08",
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
		avatars: z
			.object({
				"avatar-01": z.string(),
				"avatar-02": z.string(),
				"avatar-03": z.string(),
				"avatar-04": z.string(),
				"avatar-05": z.string(),
				"avatar-06": z.string(),
				"avatar-07": z.string(),
				"avatar-08": z.string(),
			})
			.strict(),
		board: EditorProjectSizeSchema,
		templates: z.array(TemplateSchema),
		start: StartSchema,
	})
	.strict();

export namespace ProjectFormSchema {
	export type Type = z.infer<typeof ProjectFormBaseSchema>;
}
