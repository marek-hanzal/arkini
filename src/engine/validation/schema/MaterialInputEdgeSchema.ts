import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { DiagnosticPathSchema } from "./DiagnosticPathSchema";

export const MaterialInputEdgeSchema = z
	.object({
		ownerItemId: IdSchema,
		acceptedItemId: IdSchema,
		path: DiagnosticPathSchema,
		source: z.string().min(1).optional(),
	})
	.strict()
	.meta({
		id: "MaterialInputEdgeSchema",
		description: "One expanded material-input acceptance capability edge.",
	});

export type MaterialInputEdgeSchema = typeof MaterialInputEdgeSchema;

export namespace MaterialInputEdgeSchema {
	export type Type = z.infer<MaterialInputEdgeSchema>;
}
