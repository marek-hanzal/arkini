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
	switch (diagnostic.code) {
		case "input:units-invalid":
			return `${diagnostic.ownerItemUid} · ${diagnostic.lineUid} · input ${diagnostic.inputIndex + 1}`;
		case "merge:invalid":
			return `${diagnostic.ownerItemUid} · merge ${diagnostic.mergeIndex + 1}`;
		case "line:duplicate-uid":
			return `${diagnostic.ownerItemUid} · ${diagnostic.lineUid}`;
		case "line:multiple-selections":
			return `${diagnostic.ownerItemUid} · ${diagnostic.lineUids.join(" / ")}`;
		case "units:stochastic-renewal":
		case "units:missing-renewal":
			return diagnostic.itemUid;
		case "resource:duplicate":
		case "resource:missing":
		case "resource:type-mismatch":
		case "resource:unused":
			return diagnostic.resourceUid;
		case "config:missing-reference":
			return `${diagnostic.reference} · ${diagnostic.referenceId}`;
		case "config:key-uid-mismatch":
			return `${diagnostic.key} / ${diagnostic.uid}`;
		case "source:duplicate-record":
			return `${diagnostic.entity} · ${diagnostic.key}`;
		case "source:duplicate-provider":
			return diagnostic.provider;
		case "input:acceptance-cycle":
			return diagnostic.cycle.join(" → ");
		case "source:schema-reference-conflict":
			return diagnostic.values.join(" / ");
		case "start:invalid":
			return diagnostic.failureTag;
		case "source:json-invalid":
		case "source:schema-invalid":
		case "config:schema":
			return undefined;
	}
};

/** Human-facing copy projected from one machine-readable diagnostic. */
export const readGameDiagnosticPresentationFn = (diagnostic: GameDiagnosticSchema.Type) => ({
	title: diagnosticTitles[diagnostic.code],
	detail: diagnostic.message,
	context: readDiagnosticContextFn(diagnostic),
});
