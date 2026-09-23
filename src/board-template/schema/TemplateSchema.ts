import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { SizeSchema } from "~/item-location/schema/SizeSchema";
import { PositionSchema } from "~/item-location/schema/PositionSchema";

/** A reusable authored board owns its dimensions and has no world-space identity. */
export const TemplateSchema = z
	.object({
		uid: IdSchema.describe("The immutable identity of this board template."),
		title: TitleSchema,
		...SizeSchema.shape,
		board: z.array(
			z
				.object({
					...PositionSchema.shape,
					itemId: IdSchema,
				})
				.strict(),
		),
	})
	.strict()
	.superRefine((template, context) => {
		const occupied = new Set<string>();
		for (const [index, cell] of template.board.entries()) {
			const key = `${cell.x},${cell.y}`;
			if (cell.x >= template.width || cell.y >= template.height) {
				context.addIssue({
					code: "custom",
					path: [
						"board",
						index,
					],
					message: "Template item is outside its board dimensions.",
				});
			}
			if (occupied.has(key)) {
				context.addIssue({
					code: "custom",
					path: [
						"board",
						index,
					],
					message: "Template items must occupy distinct cells.",
				});
			}
			occupied.add(key);
		}
	})
	.meta({
		id: "TemplateSchema",
		description: "An authored space-less board template with its own dimensions.",
	});

export type TemplateSchema = typeof TemplateSchema;
export namespace TemplateSchema {
	export type Type = z.infer<TemplateSchema>;
}
