import { z } from "zod";

/** The finite vocabulary of completed-game compiler and validator diagnostics. */
export const DiagnosticCodeEnumSchema = z
	.enum({
		SourceJsonInvalid: "source:json-invalid",
		ResourceDuplicate: "resource:duplicate",
		ResourceMissing: "resource:missing",
		SourceDuplicateRecord: "source:duplicate-record",
		StartInvalid: "start:invalid",
		ResourceUnused: "resource:unused",
		InputCapacityUnsupported: "input:capacity-unsupported",
		SourceDuplicateProvider: "source:duplicate-provider",
		InputMaterialTagEmpty: "input:material-tag-empty",
		ConfigMissingReference: "config:missing-reference",
		InputMaterialIneligible: "input:material-ineligible",
		SourceSchemaInvalid: "source:schema-invalid",
		InputChargesInvalid: "input:charges-invalid",
		MergeInvalid: "merge:invalid",
		DepositStochasticSoftlock: "deposit:stochastic-softlock",
		InputAcceptanceCycle: "input:acceptance-cycle",
		SourceSchemaReferenceConflict: "source:schema-reference-conflict",
		ConfigSchema: "config:schema",
		LineDuplicateId: "line:duplicate-id",
		ConfigKeyIdMismatch: "config:key-id-mismatch",
		DepositUnsustainable: "deposit:unsustainable",
	})
	.meta({
		id: "DiagnosticCodeEnumSchema",
		description: "The finite vocabulary of completed-game compiler and validator diagnostics.",
	});

export type DiagnosticCodeEnumSchema = typeof DiagnosticCodeEnumSchema;

export namespace DiagnosticCodeEnumSchema {
	export type Type = z.infer<DiagnosticCodeEnumSchema>;
}
