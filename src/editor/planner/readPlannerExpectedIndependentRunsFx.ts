import { Effect } from "effect";

import type { PlannerAcquisitionQuantityDistribution } from "~/editor/planner/PlannerAcquisitionGraph";

export namespace readPlannerExpectedIndependentRunsFx {
	export interface Props {
		readonly distribution: PlannerAcquisitionQuantityDistribution;
		readonly quantity: number;
	}
}

const quantityEpsilon = 1e-9;
const probabilityEpsilon = 1e-12;

const readForIntegerQuantity = ({
	distribution,
	quantity,
}: readPlannerExpectedIndependentRunsFx.Props) => {
	if (quantity <= 0) return 0;
	const zeroProbability = distribution.find((entry) => entry.quantity === 0)?.probability ?? 0;
	const progressProbability = 1 - zeroProbability;
	if (progressProbability <= probabilityEpsilon) return Number.POSITIVE_INFINITY;

	const expectedRuns = Array.from(
		{
			length: quantity + 1,
		},
		() => 0,
	);
	for (let remaining = 1; remaining <= quantity; remaining += 1) {
		let future = 0;
		for (const entry of distribution) {
			if (entry.quantity === 0) continue;
			future += entry.probability * expectedRuns[Math.max(0, remaining - entry.quantity)];
		}
		expectedRuns[remaining] = (1 + future) / progressProbability;
	}
	return expectedRuns[quantity] ?? Number.POSITIVE_INFINITY;
};

/** Reads the independent expected runs needed to accumulate one non-negative quantity. */
export const readPlannerExpectedIndependentRunsFx = Effect.fn(
	"readPlannerExpectedIndependentRunsFx",
)(({ distribution, quantity }: readPlannerExpectedIndependentRunsFx.Props) =>
	Effect.sync(() => {
		if (quantity <= quantityEpsilon) return 0;
		const rounded = Math.round(quantity);
		if (Math.abs(quantity - rounded) <= quantityEpsilon)
			return readForIntegerQuantity({
				distribution,
				quantity: rounded,
			});

		const lower = Math.floor(quantity);
		const upper = Math.ceil(quantity);
		const fraction = quantity - lower;
		const lowerRuns = readForIntegerQuantity({
			distribution,
			quantity: lower,
		});
		const upperRuns = readForIntegerQuantity({
			distribution,
			quantity: upper,
		});
		return lowerRuns + (upperRuns - lowerRuns) * fraction;
	}),
);
