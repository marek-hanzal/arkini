import { z } from "zod";
import { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

export const EditTemplateInputSchema = z
	.object({
		revision: NonNegativeIntegerSchema,
		templateUid: IdSchema,
		patch: z
			.object({
				title: TemplateSchema.shape.title.optional(),
				width: TemplateSchema.shape.width.optional(),
				height: TemplateSchema.shape.height.optional(),
				board: TemplateSchema.shape.board
					.optional()
					.describe(
						"Complete replacement placements; use edit_template_cells for local changes.",
					),
			})
			.strict()
			.refine((patch) => Object.keys(patch).length > 0, "Supply at least one template field.")
			.meta({
				minProperties: 1,
			}),
	})
	.strict()
	.meta({
		id: "urn:serakki:schema:mcp:edit-template-input",
		$id: "urn:serakki:schema:mcp:edit-template-input",
		title: "Edit template input",
		description:
			"Patch one template at an exact project revision. Omitted fields stay unchanged; shrinking never removes cells automatically. UID cannot change.",
	});

export type EditTemplateInputSchema = typeof EditTemplateInputSchema;
export namespace EditTemplateInputSchema {
	export type Type = z.infer<EditTemplateInputSchema>;
}
