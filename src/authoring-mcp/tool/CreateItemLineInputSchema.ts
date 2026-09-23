import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { CompleteItemLineSchema } from "./CompleteItemLineSchema";

export const CreateItemLineInputSchema = z
	.object({
		itemUid: IdSchema.describe("The exact ID of the item that owns the line."),
		revision: z
			.number()
			.int()
			.nonnegative()
			.describe("The exact project revision returned by the preceding config read."),
		line: CompleteItemLineSchema,
	})
	.strict()
	.meta({
		id: "urn:serakki:schema:mcp:create-item-line-input",
		$id: "urn:serakki:schema:mcp:create-item-line-input",
		title: "Create item line tool input",
		description: "Append one complete production line; reject an existing line ID.",
	});
export type CreateItemLineInputSchema = typeof CreateItemLineInputSchema;
export namespace CreateItemLineInputSchema {
	export type Type = z.output<CreateItemLineInputSchema>;
}
