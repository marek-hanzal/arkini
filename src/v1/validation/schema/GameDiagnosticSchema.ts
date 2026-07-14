import { z } from "zod";

import { ConfigSchemaDiagnosticSchema } from "./diagnostic/ConfigSchemaDiagnosticSchema";
import { DuplicateProviderDiagnosticSchema } from "./diagnostic/DuplicateProviderDiagnosticSchema";
import { DuplicateLineIdDiagnosticSchema } from "./diagnostic/DuplicateLineIdDiagnosticSchema";
import { EmptyMaterialTagDiagnosticSchema } from "./diagnostic/EmptyMaterialTagDiagnosticSchema";
import { UnusedResourceDiagnosticSchema } from "./diagnostic/UnusedResourceDiagnosticSchema";
import { UnsupportedInputCapacityDiagnosticSchema } from "./diagnostic/UnsupportedInputCapacityDiagnosticSchema";
import { MissingResourceDiagnosticSchema } from "./diagnostic/MissingResourceDiagnosticSchema";
import { DuplicateResourceDiagnosticSchema } from "./diagnostic/DuplicateResourceDiagnosticSchema";
import { DuplicateRecordDiagnosticSchema } from "./diagnostic/DuplicateRecordDiagnosticSchema";
import { InputAcceptanceCycleDiagnosticSchema } from "./diagnostic/InputAcceptanceCycleDiagnosticSchema";
import { InvalidInputChargesDiagnosticSchema } from "./diagnostic/InvalidInputChargesDiagnosticSchema";
import { KeyIdMismatchDiagnosticSchema } from "./diagnostic/KeyIdMismatchDiagnosticSchema";
import { LimitedDepositWarningDiagnosticSchema } from "./diagnostic/LimitedDepositWarningDiagnosticSchema";
import { StochasticLimitedDepositWarningDiagnosticSchema } from "./diagnostic/StochasticLimitedDepositWarningDiagnosticSchema";
import { MissingReferenceDiagnosticSchema } from "./diagnostic/MissingReferenceDiagnosticSchema";
import { SchemaReferenceConflictDiagnosticSchema } from "./diagnostic/SchemaReferenceConflictDiagnosticSchema";
import { StartInvalidDiagnosticSchema } from "./diagnostic/StartInvalidDiagnosticSchema";
import { SourceJsonDiagnosticSchema } from "./diagnostic/SourceJsonDiagnosticSchema";
import { SourceSchemaDiagnosticSchema } from "./diagnostic/SourceSchemaDiagnosticSchema";

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
		UnsupportedInputCapacityDiagnosticSchema,
		LimitedDepositWarningDiagnosticSchema,
		StochasticLimitedDepositWarningDiagnosticSchema,
		StartInvalidDiagnosticSchema,
		SourceJsonDiagnosticSchema,
		SourceSchemaDiagnosticSchema,
		DuplicateLineIdDiagnosticSchema,
		EmptyMaterialTagDiagnosticSchema,
	])
	.meta({
		id: "GameDiagnosticSchema",
		description: "One structured completed-game compiler or validator diagnostic.",
	});

export type GameDiagnosticSchema = typeof GameDiagnosticSchema;

export namespace GameDiagnosticSchema {
	export type Type = z.infer<GameDiagnosticSchema>;
}
