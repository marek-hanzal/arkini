import { Effect } from "effect";

import type { EditorEstimateOutputOccurrence } from "~/editor/estimator/EditorEstimateOutputOccurrence";
import type { EditorEstimateQuantityProbability } from "~/editor/estimator/EditorEstimateDependencyGraph";
import { readEditorEstimateAvailabilityRequirementsFx } from "~/editor/estimator/readEditorEstimateAvailabilityRequirementsFx";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";

const normalize = (quantities: ReadonlyMap<number, number>) => {
	const entries = [
		...quantities,
	]
		.filter(([, probability]) => probability > 1e-12)
		.sort(([left], [right]) => left - right);
	const total = entries.reduce((sum, [, probability]) => sum + probability, 0);
	return entries.map(([quantity, probability]) => ({
		probability: probability / total,
		quantity,
	}));
};

const constant = (quantity: number): ReadonlyArray<EditorEstimateQuantityProbability> => [
	{
		probability: 1,
		quantity,
	},
];

const uniform = ({ max, min }: DropSchema.Type["quantity"]) => {
	const probability = 1 / (max - min + 1);
	return Array.from(
		{
			length: max - min + 1,
		},
		(_, index) => ({
			probability,
			quantity: min + index,
		}),
	);
};

const mix = (
	branches: ReadonlyArray<{
		readonly distribution: ReadonlyArray<EditorEstimateQuantityProbability>;
		readonly probability: number;
	}>,
) => {
	const result = new Map<number, number>();
	for (const branch of branches)
		for (const entry of branch.distribution)
			result.set(
				entry.quantity,
				(result.get(entry.quantity) ?? 0) + branch.probability * entry.probability,
			);
	return normalize(result);
};

const convolve = (
	left: ReadonlyArray<EditorEstimateQuantityProbability>,
	right: ReadonlyArray<EditorEstimateQuantityProbability>,
) => {
	const result = new Map<number, number>();
	for (const leftEntry of left)
		for (const rightEntry of right) {
			const quantity = leftEntry.quantity + rightEntry.quantity;
			result.set(
				quantity,
				(result.get(quantity) ?? 0) + leftEntry.probability * rightEntry.probability,
			);
		}
	return normalize(result);
};

const repeat = (distribution: ReadonlyArray<EditorEstimateQuantityProbability>, count: number) => {
	let result = constant(0);
	for (let index = 0; index < count; index += 1) result = convolve(result, distribution);
	return result;
};

const optional = (
	distribution: ReadonlyArray<EditorEstimateQuantityProbability>,
	probability: number,
) =>
	mix([
		{
			distribution,
			probability,
		},
		{
			distribution: constant(0),
			probability: 1 - probability,
		},
	]);

const weighted = ({
	candidateProbability,
	drop,
	maximumSelections,
	minimumSelections,
	setProbability,
}: {
	readonly candidateProbability: number;
	readonly drop: DropSchema.Type;
	readonly maximumSelections: number;
	readonly minimumSelections: number;
	readonly setProbability: number;
}) => {
	const oneSelection = optional(uniform(drop.quantity), candidateProbability);
	const count = maximumSelections - minimumSelections + 1;
	const selectedSet = mix(
		Array.from(
			{
				length: count,
			},
			(_, index) => ({
				distribution: repeat(oneSelection, minimumSelections + index),
				probability: 1 / count,
			}),
		),
	);
	return optional(selectedSet, setProbability);
};

/** Enumerates authored positive-probability output occurrences without rolling runtime RNG. */
export const readEditorEstimateOutputOccurrencesFx = Effect.fn(
	"readEditorEstimateOutputOccurrencesFx",
)((output: OutputSchema.Type | undefined) =>
	Effect.gen(function* () {
		if (output === undefined) return [];
		const occurrences: EditorEstimateOutputOccurrence[] = [];
		const totalSetWeight = output.set.reduce((total, set) => total + set.weight, 0);
		for (const [setIndex, set] of output.set.entries()) {
			const setProbability = set.weight / totalSetWeight;
			for (const [rollIndex, roll] of set.roll.entries()) {
				if (roll.type === "chance" && roll.chance === 0) continue;
				if (roll.type === "weight") {
					const totalWeight = roll.drop.reduce(
						(total, candidate) => total + candidate.weight,
						0,
					);
					for (const [candidateIndex, candidate] of roll.drop.entries())
						for (const [dropIndex, drop] of candidate.drop.entries()) {
							const requirements =
								yield* readEditorEstimateAvailabilityRequirementsFx({
									rules: drop.rules,
									source: "output-condition",
								});
							occurrences.push({
								factId: drop.itemId,
								id: `set:${setIndex}:roll:${rollIndex}:candidate:${candidateIndex}:drop:${dropIndex}`,
								quantityDistribution: weighted({
									candidateProbability: candidate.weight / totalWeight,
									drop,
									maximumSelections: roll.quantity.max,
									minimumSelections: roll.quantity.min,
									setProbability,
								}),
								requirements,
							});
						}
					continue;
				}
				for (const [dropIndex, drop] of roll.drop.entries()) {
					const requirements = yield* readEditorEstimateAvailabilityRequirementsFx({
						rules: drop.rules,
						source: "output-condition",
					});
					occurrences.push({
						factId: drop.itemId,
						id: `set:${setIndex}:roll:${rollIndex}:drop:${dropIndex}`,
						quantityDistribution: optional(
							uniform(drop.quantity),
							setProbability * (roll.type === "chance" ? roll.chance : 1),
						),
						requirements,
					});
				}
			}
		}
		return occurrences;
	}),
);
