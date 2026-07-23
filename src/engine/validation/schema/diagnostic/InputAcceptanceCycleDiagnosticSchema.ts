import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";
import { InputAcceptanceCycleEdgeSchema } from "./InputAcceptanceCycleEdgeSchema";

export const InputAcceptanceCycleDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"InputAcceptanceCycle",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		cycle: z.array(IdSchema).min(2),
		edges: z.array(InputAcceptanceCycleEdgeSchema).min(1),
	})
	.strict()
	.meta({
		id: "InputAcceptanceCycleDiagnosticSchema",
		description: "Material-input capabilities allow an item ownership cycle.",
	});

export type InputAcceptanceCycleDiagnosticSchema = typeof InputAcceptanceCycleDiagnosticSchema;

export namespace InputAcceptanceCycleDiagnosticSchema {
	export type Type = z.infer<InputAcceptanceCycleDiagnosticSchema>;
}
