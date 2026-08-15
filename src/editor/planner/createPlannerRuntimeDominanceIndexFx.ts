import { Effect } from "effect";

import type {
	PlannerRuntimeDominanceIndex,
	PlannerRuntimeDominanceRegistration,
	PlannerRuntimePathLabel,
} from "~/editor/planner/PlannerRuntimeDominanceIndex";
import type { PlannerSearchOutputCertainty } from "~/editor/planner/PlannerSearch";
import { readPlannerRuntimeFingerprintFx } from "~/editor/planner/readPlannerRuntimeFingerprintFx";

interface IndexedPlannerRuntimePath extends PlannerRuntimePathLabel {
	readonly token: number;
}

const readOutputCertaintyRank = (certainty: PlannerSearchOutputCertainty) =>
	certainty === "deterministic" ? 0 : 1;

const dominatesPlannerRuntimePath = (
	left: PlannerRuntimePathLabel,
	right: PlannerRuntimePathLabel,
) =>
	readOutputCertaintyRank(left.outputCertainty) <=
		readOutputCertaintyRank(right.outputCertainty) &&
	left.selectedWitnessProbability >= right.selectedWitnessProbability &&
	left.traceLength <= right.traceLength &&
	left.elapsedMs <= right.elapsedMs;

/** Indexes canonical runtime states and keeps a conservative Pareto frontier per state. */
export const createPlannerRuntimeDominanceIndexFx = Effect.fn(
	"createPlannerRuntimeDominanceIndexFx",
)(() =>
	Effect.sync(() => {
		const pathsByFingerprint = new Map<string, IndexedPlannerRuntimePath[]>();
		const visitedFingerprints = new Set<string>();
		let nextToken = 1;

		const registerFx = Effect.fn("PlannerRuntimeDominanceIndex.registerFx")(
			({ label, runtime }) =>
				Effect.gen(function* () {
					const fingerprint = yield* readPlannerRuntimeFingerprintFx(runtime);
					const newFingerprint = !visitedFingerprints.has(fingerprint);
					visitedFingerprints.add(fingerprint);
					const existing = pathsByFingerprint.get(fingerprint) ?? [];
					if (existing.some((candidate) => dominatesPlannerRuntimePath(candidate, label)))
						return {
							accepted: false,
							fingerprint,
							newFingerprint: false,
						} satisfies PlannerRuntimeDominanceRegistration;

					const token = nextToken;
					nextToken += 1;
					pathsByFingerprint.set(fingerprint, [
						...existing.filter(
							(candidate) => !dominatesPlannerRuntimePath(label, candidate),
						),
						{
							...label,
							token,
						},
					]);
					return {
						accepted: true,
						fingerprint,
						newFingerprint,
						token,
					} satisfies PlannerRuntimeDominanceRegistration;
				}),
		);

		return {
			deactivateFx: Effect.fn("PlannerRuntimeDominanceIndex.deactivateFx")(
				(fingerprint: string, token: number) =>
					Effect.sync(() => {
						const remaining = (pathsByFingerprint.get(fingerprint) ?? []).filter(
							(candidate) => candidate.token !== token,
						);
						if (remaining.length === 0) pathsByFingerprint.delete(fingerprint);
						else pathsByFingerprint.set(fingerprint, remaining);
					}),
			),
			isActiveFx: Effect.fn("PlannerRuntimeDominanceIndex.isActiveFx")(
				(fingerprint: string, token: number) =>
					Effect.sync(() =>
						(pathsByFingerprint.get(fingerprint) ?? []).some(
							(candidate) => candidate.token === token,
						),
					),
			),
			readFingerprintCountFx: Effect.sync(() => visitedFingerprints.size),
			registerFx,
		} satisfies PlannerRuntimeDominanceIndex;
	}),
);
