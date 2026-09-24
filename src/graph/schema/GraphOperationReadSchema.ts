import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";

export const GraphOperationReadSchema = z
	.object({
		revision: z.number().int().nonnegative(),
		snapshotId: IdSchema,
		operationIds: z.array(IdSchema).min(1).max(20),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:graph-operation-configs-input",
		title: "Graph operation detail",
		description:
			"Read exact canonical operations from the revision and snapshot selected during discovery.",
	});
export type GraphOperationReadSchema = typeof GraphOperationReadSchema;
export namespace GraphOperationReadSchema {
	export type Type = z.infer<GraphOperationReadSchema>;
}
