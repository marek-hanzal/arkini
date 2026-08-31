import type {
	AcquisitionOperationOutcome,
	AcquisitionQuantityProbability,
} from "~/flow/type/AcquisitionGraph";

const maximumExpectedRunStates = 10_000;
const epsilon = 1e-12;

export type EstimateExpectedRunsResult =
	| {
			readonly runs: number;
			readonly status: "complete";
	  }
	| {
			readonly status: "state-space-unsupported";
	  };

interface ReadEstimateExpectedRunsProps {
	readonly demandByOutputGroupId: ReadonlyMap<string, number>;
	readonly distribution: ReadonlyArray<AcquisitionOperationOutcome>;
}

const readStateKeyFn = (remaining: ReadonlyArray<number>) => remaining.join("\u0000");

const isTerminalStateFn = (remaining: ReadonlyArray<number>) =>
	remaining.every((quantity) => quantity <= 0);

/** Reads bounded expected hitting time for one scalar or correlated joint output distribution. */
export const readEstimateExpectedRunsFn = ({
	demandByOutputGroupId,
	distribution,
}: ReadEstimateExpectedRunsProps): EstimateExpectedRunsResult => {
	const outputGroupIds = [
		...demandByOutputGroupId.keys(),
	].sort();
	const demands = outputGroupIds.map((id) => Math.max(0, demandByOutputGroupId.get(id) ?? 0));
	const outcomes = distribution.map((outcome) => ({
		probability: outcome.probability,
		quantities: outputGroupIds.map(
			(id) =>
				outcome.quantities.find(({ outputGroupId }) => outputGroupId === id)?.quantity ?? 0,
		),
	}));
	const deterministic = distribution.length === 1 ? outcomes[0] : undefined;
	if (deterministic?.probability === 1) {
		return {
			runs: Math.max(
				0,
				...demands.map((demand, index) => {
					if (demand <= epsilon) return 0;
					const quantity = deterministic.quantities[index] ?? 0;
					return quantity <= epsilon
						? Number.POSITIVE_INFINITY
						: Math.ceil(demand / quantity - 1e-9);
				}),
			),
			status: "complete",
		};
	}

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
			...(fraction <= epsilon
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
		.filter((remaining) => !isTerminalStateFn(remaining));
	const scheduled = new Set(pending.map(readStateKeyFn));
	while (pending.length > 0) {
		const remaining = pending.pop();
		if (remaining === undefined) break;
		const key = readStateKeyFn(remaining);
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
			const nextKey = readStateKeyFn(next);
			if (nextKey === key || isTerminalStateFn(next) || scheduled.has(nextKey)) continue;
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
			readStateKeyFn(left).localeCompare(readStateKeyFn(right)),
	);
	for (const remaining of orderedStates) {
		const key = readStateKeyFn(remaining);
		let future = 0;
		let stalledProbability = 0;
		for (const outcome of outcomes) {
			const next = remaining.map((quantity, index) =>
				Math.max(0, quantity - (outcome.quantities[index] ?? 0)),
			);
			const nextKey = readStateKeyFn(next);
			if (nextKey === key) stalledProbability += outcome.probability;
			else if (!isTerminalStateFn(next))
				future += outcome.probability * (expectedByState.get(nextKey) ?? 0);
		}
		const progressProbability = 1 - stalledProbability;
		expectedByState.set(
			key,
			progressProbability <= epsilon
				? Number.POSITIVE_INFINITY
				: (1 + future) / progressProbability,
		);
	}
	return {
		runs: corners.reduce(
			(total, { remaining, weight }) =>
				total + (expectedByState.get(readStateKeyFn(remaining)) ?? 0) * weight,
			0,
		),
		status: "complete",
	};
};

/** Reads whole authored operation batches for one scalar output distribution. */
export const readEstimateScalarExpectedRunsFn = (
	distribution: ReadonlyArray<AcquisitionQuantityProbability>,
	demand: number,
): EstimateExpectedRunsResult =>
	readEstimateExpectedRunsFn({
		demandByOutputGroupId: new Map([
			[
				"output",
				demand,
			],
		]),
		distribution: distribution.map(({ probability, quantity }) => ({
			probability,
			quantities: [
				{
					outputGroupId: "output",
					quantity,
				},
			],
		})),
	});
