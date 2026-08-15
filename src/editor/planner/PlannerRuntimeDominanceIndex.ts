import type { Effect } from "effect";

import type { PlannerSearchOutputCertainty } from "~/editor/planner/PlannerSearch";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerRuntimePathLabel {
	readonly elapsedMs: number;
	readonly outputCertainty: PlannerSearchOutputCertainty;
	readonly selectedWitnessProbability: number;
	readonly traceLength: number;
}

export type PlannerRuntimeDominanceRegistration =
	| {
			readonly accepted: false;
			readonly fingerprint: string;
			readonly newFingerprint: false;
	  }
	| {
			readonly accepted: true;
			readonly fingerprint: string;
			readonly newFingerprint: boolean;
			readonly token: number;
	  };

export interface PlannerRuntimeDominanceIndex {
	readonly deactivateFx: (fingerprint: string, token: number) => Effect.Effect<void>;
	readonly isActiveFx: (fingerprint: string, token: number) => Effect.Effect<boolean>;
	readonly readFingerprintCountFx: Effect.Effect<number>;
	readonly registerFx: (request: {
		readonly label: PlannerRuntimePathLabel;
		readonly runtime: RuntimeSchema.Type;
	}) => Effect.Effect<PlannerRuntimeDominanceRegistration>;
}
