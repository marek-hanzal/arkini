import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";

/**
 * Save-backed default-line override for each exact live line-owner identity.
 *
 * A line ID explicitly selects that line. `null` explicitly disables default
 * behavior. A missing owner key inherits the authored config fallback.
 */
export const DefaultLineByOwnerItemIdSchema = z.record(IdSchema, IdSchema.nullable()).meta({
	id: "DefaultLineByOwnerItemIdSchema",
	description:
		"Default product-line override selected for each exact live owner item; null explicitly disables the authored fallback.",
});

export type DefaultLineByOwnerItemIdSchema = typeof DefaultLineByOwnerItemIdSchema;

export namespace DefaultLineByOwnerItemIdSchema {
	export type Type = z.infer<DefaultLineByOwnerItemIdSchema>;
}
