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
		SourceDuplicateProvider: "source:duplicate-provider",
		ConfigMissingReference: "config:missing-reference",
		InputMaterialIneligible: "input:material-ineligible",
		SourceSchemaInvalid: "source:schema-invalid",
		InputUnitsInvalid: "input:units-invalid",
		MergeInvalid: "merge:invalid",
		UnitRenewalStochastic: "units:stochastic-renewal",
		InputAcceptanceCycle: "input:acceptance-cycle",
		SourceSchemaReferenceConflict: "source:schema-reference-conflict",
		ConfigSchema: "config:schema",
		ItemDuplicateUid: "item:duplicate-uid",
		LineDuplicateId: "line:duplicate-id",
		LineMultipleSelections: "line:multiple-selections",
		ConfigKeyIdMismatch: "config:key-id-mismatch",
		UnitRenewalMissing: "units:missing-renewal",
	})
	.meta({
		id: "DiagnosticCodeEnumSchema",
		description: "The finite vocabulary of completed-game compiler and validator diagnostics.",
	});

export type DiagnosticCodeEnumSchema = typeof DiagnosticCodeEnumSchema;

export namespace DiagnosticCodeEnumSchema {
	export type Type = z.infer<DiagnosticCodeEnumSchema>;
}
