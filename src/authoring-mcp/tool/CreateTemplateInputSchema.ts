import { z } from "zod";
import { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

export const CreateTemplateInputSchema = z
	.object({
		revision: NonNegativeIntegerSchema.describe(
			"Project revision from template_collection or project.",
		),
		title: TemplateSchema.shape.title,
		width: TemplateSchema.shape.width
			.optional()
			.describe("Defaults to the project's fallback width."),
		height: TemplateSchema.shape.height
			.optional()
			.describe("Defaults to the project's fallback height."),
		board: TemplateSchema.shape.board.default([]),
	})
	.strict()
	.meta({
		id: "urn:serakki:schema:mcp:create-template-input",
		$id: "urn:serakki:schema:mcp:create-template-input",
		title: "Create template input",
		description:
			"Create one board template with a generated immutable UID. Coordinates are zero-based.",
	});

export type CreateTemplateInputSchema = typeof CreateTemplateInputSchema;
export namespace CreateTemplateInputSchema {
	export type Type = z.infer<CreateTemplateInputSchema>;
}
