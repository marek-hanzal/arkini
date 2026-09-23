import { z } from "zod";
import { LineSchema } from "~/production-line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Human-facing create input; omitted fields use the Editor draft values. */
export const CreateItemInputSchema = z
	.object(ItemSchema.shape)
	.omit({
		artwork: true,
		lines: true,
		maxQueueSize: true,
		uid: true,
	})
	.extend({
		artwork: ItemSchema.shape.artwork
			.optional()
			.describe(
				"Optional Item artwork; defaults to the first Artwork resource in the open project.",
			),
		maxQueueSize: PositiveIntegerSchema.optional().describe(
			"Optional accepted active and queued work count; defaults to one.",
		),
		lines: z
			.array(
				LineSchema.omit({
					uid: true,
				}),
			)
			.optional()
			.describe(
				"Optional production lines without UIDs; every line receives a fresh immutable UID. Omitted or empty lines create a passive item.",
			),
	})
	.strict()
	.meta({
		not: ItemSchema.meta()?.not,
		if: ItemSchema.meta()?.if,
		then: ItemSchema.meta()?.then,
		id: "urn:serakki:schema:mcp:create-item-input",
		$id: "urn:serakki:schema:mcp:create-item-input",
		title: "Create item tool input",
		description: "Authoring fields accepted when creating one item.",
	});
export type CreateItemInputSchema = typeof CreateItemInputSchema;
export namespace CreateItemInputSchema {
	export type Type = z.output<CreateItemInputSchema>;
}
