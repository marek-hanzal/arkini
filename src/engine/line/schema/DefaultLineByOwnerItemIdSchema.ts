import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** Save-backed default line selected for each exact live line-owner identity. */
export const DefaultLineByOwnerItemIdSchema = z.record(IdSchema, IdSchema).meta({
	id: "DefaultLineByOwnerItemIdSchema",
	description: "Default product-line identity selected for each exact live owner item.",
});

export type DefaultLineByOwnerItemIdSchema = typeof DefaultLineByOwnerItemIdSchema;

export namespace DefaultLineByOwnerItemIdSchema {
	export type Type = z.infer<DefaultLineByOwnerItemIdSchema>;
}
