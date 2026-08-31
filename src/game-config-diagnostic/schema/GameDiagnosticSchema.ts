import { z } from "zod";

import { ConfigSchemaDiagnosticSchema } from "./ConfigSchemaDiagnosticSchema";
import { DuplicateItemUidDiagnosticSchema } from "./DuplicateItemUidDiagnosticSchema";
import { DuplicateLineIdDiagnosticSchema } from "./DuplicateLineIdDiagnosticSchema";
import { DuplicateProviderDiagnosticSchema } from "./DuplicateProviderDiagnosticSchema";
import { UnusedResourceDiagnosticSchema } from "./UnusedResourceDiagnosticSchema";
import { UnsupportedInputCapacityDiagnosticSchema } from "./UnsupportedInputCapacityDiagnosticSchema";
import { MissingResourceDiagnosticSchema } from "./MissingResourceDiagnosticSchema";
import { MultipleDefaultLinesDiagnosticSchema } from "./MultipleDefaultLinesDiagnosticSchema";
import { DuplicateResourceDiagnosticSchema } from "./DuplicateResourceDiagnosticSchema";
import { DuplicateRecordDiagnosticSchema } from "./DuplicateRecordDiagnosticSchema";
import { InputAcceptanceCycleDiagnosticSchema } from "./InputAcceptanceCycleDiagnosticSchema";
import { InvalidInputChargesDiagnosticSchema } from "./InvalidInputChargesDiagnosticSchema";
import { IneligibleMaterialInputDiagnosticSchema } from "./IneligibleMaterialInputDiagnosticSchema";
import { InvalidMergeDiagnosticSchema } from "./InvalidMergeDiagnosticSchema";
import { KeyIdMismatchDiagnosticSchema } from "./KeyIdMismatchDiagnosticSchema";
import { LimitedDepositWarningDiagnosticSchema } from "./LimitedDepositWarningDiagnosticSchema";
import { StochasticLimitedDepositWarningDiagnosticSchema } from "./StochasticLimitedDepositWarningDiagnosticSchema";
import { MissingReferenceDiagnosticSchema } from "./MissingReferenceDiagnosticSchema";
import { SchemaReferenceConflictDiagnosticSchema } from "./SchemaReferenceConflictDiagnosticSchema";
import { StartInvalidDiagnosticSchema } from "./StartInvalidDiagnosticSchema";
import { SourceJsonDiagnosticSchema } from "./SourceJsonDiagnosticSchema";
import { SourceSchemaDiagnosticSchema } from "./SourceSchemaDiagnosticSchema";

export const GameDiagnosticSchema = z
	.discriminatedUnion("code", [
		DuplicateRecordDiagnosticSchema,
		DuplicateProviderDiagnosticSchema,
		DuplicateResourceDiagnosticSchema,
		MissingResourceDiagnosticSchema,
		UnusedResourceDiagnosticSchema,
		SchemaReferenceConflictDiagnosticSchema,
		ConfigSchemaDiagnosticSchema,
		KeyIdMismatchDiagnosticSchema,
		MissingReferenceDiagnosticSchema,
		InputAcceptanceCycleDiagnosticSchema,
		InvalidInputChargesDiagnosticSchema,
		IneligibleMaterialInputDiagnosticSchema,
		InvalidMergeDiagnosticSchema,
		UnsupportedInputCapacityDiagnosticSchema,
		LimitedDepositWarningDiagnosticSchema,
		StochasticLimitedDepositWarningDiagnosticSchema,
		StartInvalidDiagnosticSchema,
		SourceJsonDiagnosticSchema,
		SourceSchemaDiagnosticSchema,
		DuplicateItemUidDiagnosticSchema,
		DuplicateLineIdDiagnosticSchema,
		MultipleDefaultLinesDiagnosticSchema,
	])
	.meta({
		id: "GameDiagnosticSchema",
		description: "One structured completed-game compiler or validator diagnostic.",
	});

export type GameDiagnosticSchema = typeof GameDiagnosticSchema;

export namespace GameDiagnosticSchema {
	export type Type = z.infer<GameDiagnosticSchema>;
}
