import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { DiagnosticPathSchema } from "../DiagnosticPathSchema";

export const InputAcceptanceCycleEdgeSchema = z
	.object({
		ownerItemId: IdSchema,
		acceptedItemId: IdSchema,
		path: DiagnosticPathSchema,
		source: z.string().min(1).optional(),
	})
	.strict()
	.meta({
		id: "InputAcceptanceCycleEdgeSchema",
		description: "One material-input capability edge participating in an acceptance cycle.",
	});

export type InputAcceptanceCycleEdgeSchema = typeof InputAcceptanceCycleEdgeSchema;

export namespace InputAcceptanceCycleEdgeSchema {
	export type Type = z.infer<InputAcceptanceCycleEdgeSchema>;
}
