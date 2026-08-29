import { Effect } from "effect";

import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { validateCanonicalIdsFn } from "../rule/fn/validateCanonicalIdsFn";
import { validateConfigReferencesFn } from "../rule/fn/validateConfigReferencesFn";
import { validateInputAcceptanceCyclesFn } from "../rule/fn/validateInputAcceptanceCyclesFn";
import { validateInputChargesFn } from "../rule/fn/validateInputChargesFn";
import { validateItemLineIdsFn } from "../rule/fn/validateItemLineIdsFn";
import { validateItemUidsFn } from "../rule/fn/validateItemUidsFn";
import { validateMaterialInputEligibilityFn } from "../rule/fn/validateMaterialInputEligibilityFn";
import { validateLimitedDepositsFn } from "../rule/fn/validateLimitedDepositsFn";
import { validateLineInputCapacityFn } from "../rule/fn/validateLineInputCapacityFn";
import { validateMergeViabilityFn } from "../rule/fn/validateMergeViabilityFn";
import { validateStartStateFx } from "../rule/validateStartStateFx";

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
