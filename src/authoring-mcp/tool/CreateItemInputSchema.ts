import { z } from "zod";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Human-facing create input; omitted fields use the Editor draft values. */
export const CreateItemInputSchema = z
	.object(ItemSchema.shape)
	.omit({
		asset: true,
		lines: true,
		maxQueueSize: true,
		maxStackSize: true,
		scope: true,
		uid: true,
	})
	.extend({
		asset: ItemSchema.shape.asset
			.optional()
			.describe("Optional visual asset; defaults to the first asset in the open project."),
		scope: ItemSchema.shape.scope
			.optional()
			.describe("Optional storage scope; defaults to any."),
		maxStackSize: PositiveIntegerSchema.optional().describe(
			"Optional maximum stack size; defaults to one.",
		),
		maxQueueSize: PositiveIntegerSchema.optional().describe(
			"Optional accepted active and queued work count; defaults to one.",
		),
		lines: ItemSchema.shape.lines
			.removeDefault()
			.optional()
			.describe("Optional production lines; omitted or empty lines create a passive item."),
	})
	.strict()
	.meta({
		not: ItemSchema.meta()?.not,
		if: ItemSchema.meta()?.if,
		then: ItemSchema.meta()?.then,
		id: "urn:arkini:schema:mcp:create-item-input",
		$id: "urn:arkini:schema:mcp:create-item-input",
		title: "Create item tool input",
		description: "Authoring fields accepted when creating one item.",
	});
export type CreateItemInputSchema = typeof CreateItemInputSchema;
export namespace CreateItemInputSchema {
	export type Type = z.output<CreateItemInputSchema>;
}
