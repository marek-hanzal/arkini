import { Effect } from "effect";

import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticRecordEntityEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { validateConfigReferencesFn } from "../fn/validateConfigReferencesFn";
import { validateInputAcceptanceCyclesFn } from "../fn/validateInputAcceptanceCyclesFn";
import { validateInputChargesFn } from "../fn/validateInputChargesFn";
import { validateItemLineIdsFn } from "../fn/validateItemLineIdsFn";
import { validateItemUidsFn } from "../fn/validateItemUidsFn";
import { validateMaterialInputEligibilityFn } from "../fn/validateMaterialInputEligibilityFn";
import { validateLimitedDepositsFn } from "../fn/validateLimitedDepositsFn";
import { validateLineInputCapacityFn } from "../fn/validateLineInputCapacityFn";
import { validateMergeViabilityFn } from "../fn/validateMergeViabilityFn";
import { validateStartStateFx } from "./validateStartStateFx";

const validateCanonicalIdsFn = ({
	config,
	provenance,
}: {
	readonly config: GameConfigSchema.Type;
	readonly provenance: GameSourceProvenanceSchema.Type;
}) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [key, item] of Object.entries(config.items)) {
		if (item.id === key) continue;
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ConfigKeyIdMismatch,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"items",
				key,
				"id",
			],
			source: provenance.items[key],
			message: `Item record key ${key} differs from embedded ID ${item.id}.`,
			entity: DiagnosticRecordEntityEnumSchema.enum.Item,
			key,
			id: item.id,
		});
	}

	return diagnostics;
};

export namespace validateGameConfigFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Runs every semantic rule owned by the completed-game validation boundary. */
export const validateGameConfigFx = Effect.fn("validateGameConfigFx")(function* ({
	config,
	provenance,
}: validateGameConfigFx.Props) {
	const diagnostics = [
		validateCanonicalIdsFn({
			config,
			provenance,
		}),
		validateConfigReferencesFn({
			config,
			provenance,
		}),
		validateInputAcceptanceCyclesFn({
			config,
			provenance,
		}),
		validateItemLineIdsFn({
			config,
			provenance,
		}),
		validateItemUidsFn({
			config,
			provenance,
		}),
		validateMaterialInputEligibilityFn({
			config,
			provenance,
		}),
		validateLineInputCapacityFn({
			config,
			provenance,
		}),
		validateInputChargesFn({
			config,
			provenance,
		}),
		validateMergeViabilityFn({
			config,
			provenance,
		}),
		validateLimitedDepositsFn({
			config,
			provenance,
		}),
		yield* validateStartStateFx({
			config,
			provenance,
		}),
	];

	return diagnostics.flat();
});
