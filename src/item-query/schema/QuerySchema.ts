import { z } from "zod";
import { DistanceSchema } from "~/item-location/schema/DistanceSchema";
import { BaseSchema } from "./BaseSchema";

/** Authored item selection with one explicit spatial reach. */
export const QuerySchema = z
	.object({
		...BaseSchema.shape,
		distance: DistanceSchema,
	})
	.strict()
	.meta({
		id: "QuerySchema",
		description: "An item selector and its spatial reach from self through the whole universe.",
	});
export type QuerySchema = typeof QuerySchema;
export namespace QuerySchema {
	export type Type = z.infer<QuerySchema>;
}
