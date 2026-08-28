import { Effect } from "effect";

import type { EditorAcquisitionOperationOutcome } from "~/editor/EditorAcquisitionGraph";

const maximumExpectedRunStates = 10_000;

type EditorEstimateExpectedRunsResult =
	| {
			readonly runs: number;
			readonly status: "complete";
	  }
	| {
			readonly status: "state-space-unsupported";
	  };

export interface EditorEstimateExpectedRuns {
	readonly read: (input: {
		readonly demandByOutputGroupId: ReadonlyMap<string, number>;
		readonly distribution: ReadonlyArray<EditorAcquisitionOperationOutcome>;
	}) => EditorEstimateExpectedRunsResult;
}

/** Creates the bounded expected hitting-time algebra shared by scalar and joint outputs. */
export const createEditorEstimateExpectedRunsFx = Effect.fn("createEditorEstimateExpectedRunsFx")(
	() =>
		Effect.sync((): EditorEstimateExpectedRuns => {
			const resultByDistribution = new WeakMap<
				ReadonlyArray<EditorAcquisitionOperationOutcome>,
				Map<string, EditorEstimateExpectedRunsResult>
			>();
			const readUncached: EditorEstimateExpectedRuns["read"] = ({
				demandByOutputGroupId,
				distribution,
			}) => {
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
				const keyOf = (remaining: ReadonlyArray<number>) => remaining.join("\u0000");
				const isTerminal = (remaining: ReadonlyArray<number>) =>
					remaining.every((quantity) => quantity <= 0);
				let corners: ReadonlyArray<{
					readonly remaining: ReadonlyArray<number>;
					readonly weight: number;
				}> = [
					{
						remaining: [],
						weight: 1,
					},
				];
				for (const demand of demands) {
					const lower = Math.floor(demand);
					const fraction = demand - lower;
					corners = corners.flatMap(({ remaining, weight }) => [
						{
							remaining: [
								...remaining,
								lower,
							],
							weight: weight * (1 - fraction),
						},
						...(fraction <= 1e-12
							? []
							: [
									{
										remaining: [
											...remaining,
											lower + 1,
										],
										weight: weight * fraction,
									},
								]),
					]);
					if (corners.length > maximumExpectedRunStates)
						return {
							status: "state-space-unsupported",
						};
				}

				const states = new Map<string, ReadonlyArray<number>>();
				const pending = corners
					.map(({ remaining }) => remaining)
					.filter((remaining) => !isTerminal(remaining));
				const scheduled = new Set(pending.map(keyOf));
				while (pending.length > 0) {
					const remaining = pending.pop();
					if (remaining === undefined) break;
					const key = keyOf(remaining);
					if (states.has(key)) continue;
					if (states.size >= maximumExpectedRunStates)
						return {
							status: "state-space-unsupported",
						};
					states.set(key, remaining);
					for (const outcome of outcomes) {
						const next = remaining.map((quantity, index) =>
							Math.max(0, quantity - (outcome.quantities[index] ?? 0)),
						);
						const nextKey = keyOf(next);
						if (nextKey === key || isTerminal(next) || scheduled.has(nextKey)) continue;
						if (scheduled.size >= maximumExpectedRunStates)
							return {
								status: "state-space-unsupported",
							};
						scheduled.add(nextKey);
						pending.push(next);
					}
				}

				const expectedByState = new Map<string, number>();
				const orderedStates = [
					...states.values(),
				].sort(
					(left, right) =>
						left.reduce((total, quantity) => total + quantity, 0) -
							right.reduce((total, quantity) => total + quantity, 0) ||
						keyOf(left).localeCompare(keyOf(right)),
				);
				for (const remaining of orderedStates) {
					const key = keyOf(remaining);
					let future = 0;
					let stalledProbability = 0;
					for (const outcome of outcomes) {
						const next = remaining.map((quantity, index) =>
							Math.max(0, quantity - (outcome.quantities[index] ?? 0)),
						);
						const nextKey = keyOf(next);
						if (nextKey === key) stalledProbability += outcome.probability;
						else if (!isTerminal(next))
							future += outcome.probability * (expectedByState.get(nextKey) ?? 0);
					}
					const progressProbability = 1 - stalledProbability;
					if (progressProbability <= 1e-12)
						expectedByState.set(key, Number.POSITIVE_INFINITY);
					else expectedByState.set(key, (1 + future) / progressProbability);
				}
				const runs = corners.reduce(
					(total, { remaining, weight }) =>
						total + (expectedByState.get(keyOf(remaining)) ?? 0) * weight,
					0,
				);
				return {
					runs,
					status: "complete",
				};
			};
			return {
				read: (input) => {
					const key = [
						...input.demandByOutputGroupId.entries(),
					]
						.sort(([left], [right]) => left.localeCompare(right))
						.map(([id, quantity]) => `${id}\u0000${quantity}`)
						.join("\u0001");
					const cachedByDemand = resultByDistribution.get(input.distribution);
					const cached = cachedByDemand?.get(key);
					if (cached !== undefined) return cached;
					const result = readUncached(input);
					const byDemand =
						cachedByDemand ?? new Map<string, EditorEstimateExpectedRunsResult>();
					byDemand.set(key, result);
					if (cachedByDemand === undefined)
						resultByDistribution.set(input.distribution, byDemand);
					return result;
				},
			};
		}),
);
