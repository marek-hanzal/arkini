import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

export const OutputItemIdsSchema = z.array(IdSchema).meta({
	id: "OutputItemIdsSchema",
	description: "Canonical item IDs that one output may emit through any configured branch.",
});

export type OutputItemIdsSchema = typeof OutputItemIdsSchema;

export namespace OutputItemIdsSchema {
	export type Type = z.infer<OutputItemIdsSchema>;
}
