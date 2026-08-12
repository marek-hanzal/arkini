import type { PlannerSearchOutputCertainty } from "~/editor/planner/PlannerSearch";
import { readPlannerRuntimeFingerprint } from "~/editor/planner/readPlannerRuntimeFingerprint";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface PlannerRuntimePathLabel {
	readonly elapsedMs: number;
	readonly outputCertainty: PlannerSearchOutputCertainty;
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

interface IndexedPlannerRuntimePath extends PlannerRuntimePathLabel {
	readonly token: number;
}

const readOutputCertaintyRank = (certainty: PlannerSearchOutputCertainty) =>
	certainty === "deterministic" ? 0 : 1;

/** True when left reaches the same runtime with no worse reporting provenance. */
export const dominatesPlannerRuntimePath = (
	left: PlannerRuntimePathLabel,
	right: PlannerRuntimePathLabel,
) =>
	readOutputCertaintyRank(left.outputCertainty) <=
		readOutputCertaintyRank(right.outputCertainty) &&
	left.traceLength <= right.traceLength &&
	left.elapsedMs <= right.elapsedMs;

/**
 * Indexes canonical runtime states and keeps a conservative Pareto frontier per state.
 *
 * Arbitrary resource-superset dominance is intentionally absent: extra items may trigger authored
 * disable/count/maxCount rules, so "more" is not globally monotone. We only discard paths that
 * reach the exact same canonical runtime with no better certainty, trace length or authored time.
 */
export const createPlannerRuntimeDominanceIndex = () => {
	const pathsByFingerprint = new Map<string, IndexedPlannerRuntimePath[]>();
	let nextToken = 1;

	const register = ({
		label,
		runtime,
	}: {
		readonly label: PlannerRuntimePathLabel;
		readonly runtime: RuntimeSchema.Type;
	}): PlannerRuntimeDominanceRegistration => {
		const fingerprint = readPlannerRuntimeFingerprint(runtime);
		const existing = pathsByFingerprint.get(fingerprint) ?? [];
		if (existing.some((candidate) => dominatesPlannerRuntimePath(candidate, label)))
			return {
				accepted: false,
				fingerprint,
				newFingerprint: false,
			};

		const token = nextToken;
		nextToken += 1;
		pathsByFingerprint.set(fingerprint, [
			...existing.filter((candidate) => !dominatesPlannerRuntimePath(label, candidate)),
			{
				...label,
				token,
			},
		]);
		return {
			accepted: true,
			fingerprint,
			newFingerprint: existing.length === 0,
			token,
		};
	};

	return {
		isActive: (fingerprint: string, token: number) =>
			(pathsByFingerprint.get(fingerprint) ?? []).some(
				(candidate) => candidate.token === token,
			),
		readFingerprintCount: () => pathsByFingerprint.size,
		register,
	};
};
