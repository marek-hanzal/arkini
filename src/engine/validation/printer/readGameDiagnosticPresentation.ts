import type { GameDiagnosticSchema } from "~/engine/validation/schema/GameDiagnosticSchema";
import type { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";

const diagnosticTitles = {
	"source:json-invalid": "Invalid JSON source",
	"resource:duplicate": "Duplicate asset",
	"resource:missing": "Missing asset",
	"source:duplicate-record": "Duplicate source record",
	"start:invalid": "Invalid game start",
	"resource:unused": "Unused asset",
	"input:capacity-unsupported": "Unsupported input capacity",
	"source:duplicate-provider": "Duplicate source provider",
	"config:missing-reference": "Missing item reference",
	"input:material-ineligible": "Ineligible material input",
	"source:schema-invalid": "Invalid source value",
	"input:charges-invalid": "Invalid input charge contract",
	"merge:invalid": "Invalid merge",
	"deposit:stochastic-softlock": "Deposit may become unavailable",
	"input:acceptance-cycle": "Circular material acceptance",
	"source:schema-reference-conflict": "Conflicting schema references",
	"config:schema": "Invalid project value",
	"item:duplicate-uid": "Duplicate item UID",
	"line:duplicate-id": "Duplicate production line ID",
	"line:multiple-defaults": "Multiple default production lines",
	"config:key-id-mismatch": "Item key and ID differ",
	"deposit:unsustainable": "Deposit cannot be recreated",
} satisfies Record<DiagnosticCodeEnumSchema.Type, string>;

const readDiagnosticContext = (diagnostic: GameDiagnosticSchema.Type): string | undefined => {
	switch (diagnostic.code) {
		case "input:capacity-unsupported":
		case "input:material-ineligible":
		case "input:charges-invalid":
			return `${diagnostic.ownerItemId} · ${diagnostic.lineId} · input ${diagnostic.inputIndex + 1}`;
		case "merge:invalid":
			return `${diagnostic.ownerItemId} · merge ${diagnostic.mergeIndex + 1}`;
		case "line:duplicate-id":
			return `${diagnostic.ownerItemId} · ${diagnostic.lineId}`;
		case "line:multiple-defaults":
			return `${diagnostic.ownerItemId} · ${diagnostic.lineIds.join(" / ")}`;
		case "item:duplicate-uid":
			return diagnostic.itemIds.join(" / ");
		case "deposit:stochastic-softlock":
		case "deposit:unsustainable":
			return diagnostic.itemId;
		case "resource:duplicate":
		case "resource:missing":
		case "resource:unused":
			return diagnostic.resourceId;
		case "config:missing-reference":
			return `${diagnostic.reference} · ${diagnostic.referenceId}`;
		case "config:key-id-mismatch":
			return `${diagnostic.key} / ${diagnostic.id}`;
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
export const readGameDiagnosticPresentation = (diagnostic: GameDiagnosticSchema.Type) => ({
	title: diagnosticTitles[diagnostic.code],
	detail: diagnostic.message,
	context: readDiagnosticContext(diagnostic),
});
