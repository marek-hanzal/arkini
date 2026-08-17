import { Effect } from "effect";

import type { EditorAcquisitionOperationOutcome } from "~/editor/EditorAcquisitionGraph";

const maximumExpectedRunStates = 10_000;

export interface EditorEstimateExpectedRuns {
	readonly read: (input: {
		readonly demandByOutputGroupId: ReadonlyMap<string, number>;
		readonly distribution: ReadonlyArray<EditorAcquisitionOperationOutcome>;
	}) =>
		| {
				readonly runs: number;
				readonly status: "complete";
		  }
		| {
				readonly status: "state-space-unsupported";
		  };
}

/** Creates the bounded expected hitting-time algebra shared by scalar and joint outputs. */
export const createEditorEstimateExpectedRunsFx = Effect.fn("createEditorEstimateExpectedRunsFx")(
	() =>
		Effect.sync(
			(): EditorEstimateExpectedRuns => ({
				read: ({ demandByOutputGroupId, distribution }) => {
					const outputGroupIds = [
						...demandByOutputGroupId.keys(),
					].sort();
					const demands = outputGroupIds.map((id) =>
						Math.max(0, demandByOutputGroupId.get(id) ?? 0),
					);
					const outcomes = distribution.map((outcome) => ({
						probability: outcome.probability,
						quantities: outputGroupIds.map(
							(id) =>
								outcome.quantities.find(({ outputGroupId }) => outputGroupId === id)
									?.quantity ?? 0,
						),
					}));
					const deterministic = distribution.length === 1 ? outcomes[0] : undefined;
					if (deterministic?.probability === 1) {
						return {
							runs: Math.max(
								0,
								...demands.map((demand, index) => {
									if (demand <= 1e-12) return 0;
									const quantity = deterministic.quantities[index] ?? 0;
									return quantity <= 1e-12
										? Number.POSITIVE_INFINITY
										: Math.ceil(demand / quantity - 1e-9);
								}),
							),
							status: "complete",
						};
					}
					const radices = demands.map((demand) => Math.ceil(demand - 1e-9) + 1);
					const stateCount = radices.reduce((total, radix) => total * radix, 1);
					// The all-zero terminal is not computed, so the bound counts actual DP states.
					if (
						!Number.isSafeInteger(stateCount) ||
						stateCount - 1 > maximumExpectedRunStates
					)
						return {
							status: "state-space-unsupported",
						};
					const expected = Array<number>(stateCount).fill(0);
					for (let state = 1; state < stateCount; state += 1) {
						let remainder = state;
						const remaining = radices.map((radix) => {
							const value = remainder % radix;
							remainder = Math.floor(remainder / radix);
							return value;
						});
						let future = 0;
						let stalledProbability = 0;
						for (const outcome of outcomes) {
							let nextState = 0;
							let multiplier = 1;
							for (const [index, radix] of radices.entries()) {
								const next = Math.max(
									0,
									(remaining[index] ?? 0) - (outcome.quantities[index] ?? 0),
								);
								nextState += next * multiplier;
								multiplier *= radix;
							}
							if (nextState < state)
								future += outcome.probability * (expected[nextState] ?? 0);
							else stalledProbability += outcome.probability;
						}
						const progressProbability = 1 - stalledProbability;
						if (progressProbability <= 1e-12)
							return {
								runs: Number.POSITIVE_INFINITY,
								status: "complete",
							};
						expected[state] = (1 + future) / progressProbability;
					}

					let runs = 0;
					const addInterpolatedCorner = (
						index: number,
						state: number,
						weight: number,
						multiplier: number,
					) => {
						if (index === radices.length) {
							runs += (expected[state] ?? 0) * weight;
							return;
						}
						const demand = demands[index] ?? 0;
						const lower = Math.floor(demand);
						const fraction = demand - lower;
						const nextMultiplier = multiplier * (radices[index] ?? 1);
						addInterpolatedCorner(
							index + 1,
							state + lower * multiplier,
							weight * (1 - fraction),
							nextMultiplier,
						);
						if (fraction > 1e-12)
							addInterpolatedCorner(
								index + 1,
								state + (lower + 1) * multiplier,
								weight * fraction,
								nextMultiplier,
							);
					};
					addInterpolatedCorner(0, 0, 1, 1);
					return {
						runs,
						status: "complete",
					};
				},
			}),
		),
);
