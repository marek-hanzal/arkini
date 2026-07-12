import { Effect } from "effect";

import type { GameSourceProvenanceSchema } from "~/v1/compiler/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { validateCanonicalIdsFx } from "../rule/validateCanonicalIdsFx";
import { validateConfigReferencesFx } from "../rule/validateConfigReferencesFx";
import { validateInputAcceptanceCyclesFx } from "../rule/validateInputAcceptanceCyclesFx";
import { validateLimitedDepositsFx } from "../rule/validateLimitedDepositsFx";
import { validateOutputReplaceCardinalityFx } from "../rule/validateOutputReplaceCardinalityFx";

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
	const diagnostics = yield* Effect.all([
		validateCanonicalIdsFx({
			config,
			provenance,
		}),
		validateConfigReferencesFx({
			config,
			provenance,
		}),
		validateInputAcceptanceCyclesFx({
			config,
			provenance,
		}),
		validateOutputReplaceCardinalityFx({
			config,
			provenance,
		}),
		validateLimitedDepositsFx({
			config,
			provenance,
		}),
	]);

	return diagnostics.flat();
});
