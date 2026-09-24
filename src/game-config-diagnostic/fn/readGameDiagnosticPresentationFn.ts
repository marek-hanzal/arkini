import { match } from "ts-pattern";
import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import type { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";

const diagnosticTitles = {
	"source:json-invalid": "Invalid JSON source",
	"resource:duplicate": "Duplicate resource",
	"resource:missing": "Missing resource",
	"resource:type-mismatch": "Wrong resource type",
	"source:duplicate-record": "Duplicate source record",
	"start:invalid": "Invalid game start",
	"resource:unused": "Unused resource",
	"source:duplicate-provider": "Duplicate source provider",
	"config:missing-reference": "Missing item reference",
	"source:schema-invalid": "Invalid source value",
	"input:units-invalid": "Invalid input unit contract",
	"merge:invalid": "Invalid merge",
	"units:stochastic-renewal": "Finite item may become unavailable",
	"input:acceptance-cycle": "Circular material acceptance",
	"source:schema-reference-conflict": "Conflicting schema references",
	"config:schema": "Invalid project value",
	"line:duplicate-uid": "Duplicate production line UID",
	"line:multiple-selections": "Multiple selected production lines",
	"config:key-uid-mismatch": "Item key and UID differ",
	"units:missing-renewal": "Finite item cannot be recreated",
} satisfies Record<DiagnosticCodeEnumSchema.Type, string>;

const readDiagnosticContextFn = (diagnostic: GameDiagnosticSchema.Type): string | undefined => {
	return match(diagnostic)
		.with(
			{
				code: "input:units-invalid",
			},
			(diagnostic) =>
				`${diagnostic.ownerItemUid} · ${diagnostic.lineUid} · input ${diagnostic.inputIndex + 1}`,
		)
		.with(
			{
				code: "merge:invalid",
			},
			(diagnostic) => `${diagnostic.ownerItemUid} · merge ${diagnostic.mergeIndex + 1}`,
		)
		.with(
			{
				code: "line:duplicate-uid",
			},
			(diagnostic) => `${diagnostic.ownerItemUid} · ${diagnostic.lineUid}`,
		)
		.with(
			{
				code: "line:multiple-selections",
			},
			(diagnostic) => `${diagnostic.ownerItemUid} · ${diagnostic.lineUids.join(" / ")}`,
		)
		.with(
			{
				code: "units:stochastic-renewal",
			},
			{
				code: "units:missing-renewal",
			},
			(diagnostic) => diagnostic.itemUid,
		)
		.with(
			{
				code: "resource:duplicate",
			},
			{
				code: "resource:missing",
			},
			{
				code: "resource:type-mismatch",
			},
			{
				code: "resource:unused",
			},
			(diagnostic) => diagnostic.resourceUid,
		)
		.with(
			{
				code: "config:missing-reference",
			},
			(diagnostic) => `${diagnostic.reference} · ${diagnostic.referenceId}`,
		)
		.with(
			{
				code: "config:key-uid-mismatch",
			},
			(diagnostic) => `${diagnostic.key} / ${diagnostic.uid}`,
		)
		.with(
			{
				code: "source:duplicate-record",
			},
			(diagnostic) => `${diagnostic.entity} · ${diagnostic.key}`,
		)
		.with(
			{
				code: "source:duplicate-provider",
			},
			(diagnostic) => diagnostic.provider,
		)
		.with(
			{
				code: "input:acceptance-cycle",
			},
			(diagnostic) => diagnostic.cycle.join(" → "),
		)
		.with(
			{
				code: "source:schema-reference-conflict",
			},
			(diagnostic) => diagnostic.values.join(" / "),
		)
		.with(
			{
				code: "start:invalid",
			},
			(diagnostic) => diagnostic.failureTag,
		)
		.with(
			{
				code: "source:json-invalid",
			},
			{
				code: "source:schema-invalid",
			},
			{
				code: "config:schema",
			},
			() => undefined,
		)
		.exhaustive();
};

/** Human-facing copy projected from one machine-readable diagnostic. */
export const readGameDiagnosticPresentationFn = (diagnostic: GameDiagnosticSchema.Type) => ({
	title: diagnosticTitles[diagnostic.code],
	detail: diagnostic.message,
	context: readDiagnosticContextFn(diagnostic),
});
