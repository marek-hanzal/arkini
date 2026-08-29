import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { ScopeSchema } from "./ScopeSchema";

/** A query that selects matching toolbar items without board distance. */
export const ToolbarSchema = z
	.object({
		...BaseSchema.shape,
		scope: ScopeSchema.extract([
			"Toolbar",
		]).describe("Identifies this query as a toolbar-only query."),
	})
	.strict()
	.meta({
		id: "query.ToolbarSchema",
		description: "A toolbar-only item query without a board distance.",
	});

export type ToolbarSchema = typeof ToolbarSchema;

export namespace ToolbarSchema {
	export type Type = z.infer<ToolbarSchema>;
}
