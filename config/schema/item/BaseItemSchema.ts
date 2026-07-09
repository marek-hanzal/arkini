import { z } from "zod";

import { IdSchema } from "../util/IdSchema";

/**
 * Fields shared by every item configuration.
 *
 * Specialized item schemas spread `BaseItemSchema.shape` to preserve this common
 * contract while adding their discriminator and future type-specific fields.
 */
export const BaseItemSchema = z
	.object({
		id: IdSchema,
	})
	.strict()
	.describe("The common fields shared by every game item.");

export type BaseItemSchema = typeof BaseItemSchema;

export namespace BaseItemSchema {
	export type Type = z.infer<BaseItemSchema>;
}
