import { Effect } from "effect";

import type {
	EditorAcquisitionOperationOutcome,
	EditorAcquisitionOutputAnnotation,
	EditorAcquisitionQuantityProbability,
	EditorAcquisitionRequirement,
	EditorAcquisitionUnsupportedRequirement,
} from "~/editor/EditorAcquisitionGraph";
import { readEditorAcquisitionAvailabilityRequirementsFx } from "~/editor/readEditorAcquisitionAvailabilityRequirementsFx";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";

const maximumOutcomeStates = 4_096;
type Distribution = ReadonlyArray<{
	readonly probability: number;
	readonly quantities: ReadonlyMap<string, number>;
}>;

interface OutputOccurrence {
	readonly annotation: EditorAcquisitionOutputAnnotation;
	readonly factId: string;
	readonly id: string;
	readonly operationOutputGroupId: string;
	readonly occurrenceQuantityDistribution: ReadonlyArray<EditorAcquisitionQuantityProbability>;
	readonly quantityDistribution: ReadonlyArray<EditorAcquisitionQuantityProbability>;
	readonly requirements: {
		readonly allOf: ReadonlyArray<EditorAcquisitionRequirement>;
		readonly anyOf: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
		readonly unsupported?: ReadonlyArray<EditorAcquisitionUnsupportedRequirement>;
	};
}

interface EditorAcquisitionOutputModel {
	readonly compilation: "complete" | "state-space-unsupported";
	readonly occurrences: ReadonlyArray<OutputOccurrence>;
	readonly outputDistribution: ReadonlyArray<EditorAcquisitionOperationOutcome>;
}

const stateKey = (quantities: ReadonlyMap<string, number>) =>
	[
		...quantities,
	]
		.filter(([, quantity]) => quantity > 0)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([id, quantity]) => `${id}:${quantity}`)
		.join("\u0000");

const normalize = (distribution: Distribution): Distribution => {
	const merged = new Map<
		string,
		{
			probability: number;
			quantities: ReadonlyMap<string, number>;
		}
	>();
	for (const outcome of distribution) {
		const key = stateKey(outcome.quantities);
		const current = merged.get(key);
		merged.set(key, {
			probability: (current?.probability ?? 0) + outcome.probability,
			quantities: current?.quantities ?? outcome.quantities,
		});
	}
	const outcomes = [
		...merged.values(),
	].filter(({ probability }) => probability > 1e-12);
	const total = outcomes.reduce((sum, { probability }) => sum + probability, 0);
	return outcomes
		.map((outcome) => ({
			...outcome,
			probability: outcome.probability / total,
		}))
		.sort((left, right) => stateKey(left.quantities).localeCompare(stateKey(right.quantities)));
};

const constant = (id?: string, quantity = 0): Distribution => [
	{
		probability: 1,
		quantities:
			id === undefined || quantity <= 0
				? new Map()
				: new Map([
						[
							id,
							quantity,
						],
					]),
	},
];

const mix = (
	branches: ReadonlyArray<{
		readonly distribution: Distribution;
		readonly probability: number;
	}>,
): Distribution | undefined => {
	if (
		branches.reduce((sum, branch) => sum + branch.distribution.length, 0) > maximumOutcomeStates
	)
		return undefined;
	return normalize(
		branches.flatMap((branch) =>
			branch.distribution.map((outcome) => ({
				...outcome,
				probability: outcome.probability * branch.probability,
			})),
		),
	);
};

const convolve = (left: Distribution | undefined, right: Distribution | undefined) => {
	if (
		left === undefined ||
		right === undefined ||
		left.length * right.length > maximumOutcomeStates
	)
		return undefined;
	return normalize(
		left.flatMap((leftOutcome) =>
			right.map((rightOutcome) => {
				const quantities = new Map(leftOutcome.quantities);
				for (const [id, quantity] of rightOutcome.quantities)
					quantities.set(id, (quantities.get(id) ?? 0) + quantity);
				return {
					probability: leftOutcome.probability * rightOutcome.probability,
					quantities,
				};
			}),
		),
	);
};

const repeat = (distribution: Distribution | undefined, count: number) => {
	if (distribution === undefined || count > maximumOutcomeStates) return undefined;
	let result: Distribution | undefined = constant();
	for (let index = 0; index < count && result !== undefined; index += 1)
		result = convolve(result, distribution);
	return result;
};

const optional = (distribution: Distribution | undefined, probability: number) =>
	distribution === undefined
		? undefined
		: mix([
				{
					distribution,
					probability,
				},
				{
					distribution: constant(),
					probability: 1 - probability,
				},
			]);

const marginal = (
	distribution: Distribution,
	readQuantity: (quantities: ReadonlyMap<string, number>) => number,
) => {
	const probabilities = new Map<number, number>();
	for (const outcome of distribution) {
		const quantity = readQuantity(outcome.quantities);
		probabilities.set(quantity, (probabilities.get(quantity) ?? 0) + outcome.probability);
	}
	return [
		...probabilities,
	]
		.filter(([, probability]) => probability > 1e-12)
		.sort(([left], [right]) => left - right)
		.map(([quantity, probability]) => ({
			probability,
			quantity,
		}));
};

const requirementKey = (requirements: {
	readonly allOf: ReadonlyArray<EditorAcquisitionRequirement>;
	readonly anyOf: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
}) =>
	JSON.stringify({
		allOf: [
			...requirements.allOf,
		].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
		anyOf: requirements.anyOf.map((clause) =>
			[
				...clause,
			].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
		),
	});

/** Compiles one bounded occurrence-keyed distribution, then derives every public marginal. */
export const readEditorAcquisitionOutputOccurrencesFx = Effect.fn(
	"readEditorAcquisitionOutputOccurrencesFx",
)((output: OutputSchema.Type | undefined) =>
	Effect.gen(function* () {
		if (output === undefined)
			return {
				compilation: "complete",
				occurrences: [],
				outputDistribution: [
					{
						probability: 1,
						quantities: [],
					},
				],
			} satisfies EditorAcquisitionOutputModel;

		const drafts: Array<
			Omit<OutputOccurrence, "occurrenceQuantityDistribution" | "quantityDistribution">
		> = [];
		const groupByKey = new Map<string, string>();
		const occurrenceIdsByGroup = new Map<string, string[]>();
		const readDropFx = Effect.fn("readEditorAcquisitionOutputOccurrencesFx.drop")(function* (
			drop: DropSchema.Type,
			id: string,
			annotation: EditorAcquisitionOutputAnnotation,
		) {
			const requirements = yield* readEditorAcquisitionAvailabilityRequirementsFx({
				rules: drop.rules,
				source: "output-condition",
			});
			const key = `${drop.itemId}\u0000${requirementKey(requirements)}`;
			const groupId = groupByKey.get(key) ?? `output:${groupByKey.size}`;
			groupByKey.set(key, groupId);
			const ids = occurrenceIdsByGroup.get(groupId) ?? [];
			ids.push(id);
			occurrenceIdsByGroup.set(groupId, ids);
			drafts.push({
				annotation,
				factId: drop.itemId,
				id,
				operationOutputGroupId: groupId,
				requirements,
			});
			const count = drop.quantity.max - drop.quantity.min + 1;
			if (!Number.isSafeInteger(count) || count > maximumOutcomeStates) return undefined;
			return Array.from(
				{
					length: count,
				},
				(_, index) => ({
					probability: 1 / count,
					quantities: new Map([
						[
							id,
							drop.quantity.min + index,
						],
					]),
				}),
			) satisfies Distribution;
		});

		const totalSetWeight = output.set.reduce((total, set) => total + set.weight, 0);
		const setBranches: Array<{
			distribution: Distribution;
			probability: number;
		}> = [];
		let unsupported = false;
		for (const [setIndex, set] of output.set.entries()) {
			let setDistribution: Distribution | undefined = constant();
			for (const [rollIndex, roll] of set.roll.entries()) {
				if (roll.type === "chance" && roll.chance === 0) continue;
				let rollDistribution: Distribution | undefined;
				if (roll.type === "weight") {
					const totalWeight = roll.drop.reduce(
						(total, candidate) => total + candidate.weight,
						0,
					);
					const candidates: Array<{
						distribution: Distribution;
						probability: number;
					}> = [];
					for (const [candidateIndex, candidate] of roll.drop.entries()) {
						let candidateDistribution: Distribution | undefined = constant();
						for (const [dropIndex, drop] of candidate.drop.entries()) {
							const id = `set:${setIndex}:roll:${rollIndex}:candidate:${candidateIndex}:drop:${dropIndex}`;
							candidateDistribution = convolve(
								candidateDistribution,
								yield* readDropFx(drop, id, {
									alternativeSet: output.set.length > 1,
									placement: drop.placement,
									quantity: drop.quantity,
									selectionKind: "weighted",
								}),
							);
						}
						if (candidateDistribution === undefined) unsupported = true;
						else
							candidates.push({
								distribution: candidateDistribution,
								probability: candidate.weight / totalWeight,
							});
					}
					const selection = unsupported ? undefined : mix(candidates);
					const count = roll.quantity.max - roll.quantity.min + 1;
					const repetitions: Array<{
						distribution: Distribution;
						probability: number;
					}> = [];
					if (!Number.isSafeInteger(count) || count > maximumOutcomeStates)
						rollDistribution = undefined;
					else {
						for (let index = 0; index < count; index += 1) {
							const distribution = repeat(selection, roll.quantity.min + index);
							if (distribution === undefined) break;
							repetitions.push({
								distribution,
								probability: 1 / count,
							});
						}
						rollDistribution =
							repetitions.length === count ? mix(repetitions) : undefined;
					}
				} else {
					let drops: Distribution | undefined = constant();
					for (const [dropIndex, drop] of roll.drop.entries()) {
						const id = `set:${setIndex}:roll:${rollIndex}:drop:${dropIndex}`;
						drops = convolve(
							drops,
							yield* readDropFx(drop, id, {
								alternativeSet: output.set.length > 1,
								placement: drop.placement,
								quantity: drop.quantity,
								selectionKind: roll.type,
							}),
						);
					}
					rollDistribution =
						roll.type === "chance" ? optional(drops, roll.chance) : drops;
				}
				setDistribution = convolve(setDistribution, rollDistribution);
				if (setDistribution === undefined) unsupported = true;
			}
			if (setDistribution !== undefined)
				setBranches.push({
					distribution: setDistribution,
					probability: set.weight / totalSetWeight,
				});
		}

		const occurrenceDistribution = unsupported ? undefined : mix(setBranches);
		if (occurrenceDistribution === undefined)
			return {
				compilation: "state-space-unsupported",
				occurrences: drafts.map((draft) => ({
					...draft,
					occurrenceQuantityDistribution: [],
					quantityDistribution: [],
				})),
				outputDistribution: [],
			} satisfies EditorAcquisitionOutputModel;

		const groupDistribution = occurrenceDistribution.map(({ probability, quantities }) => ({
			probability,
			quantities: new Map(
				[
					...occurrenceIdsByGroup,
				].map(([groupId, ids]) => [
					groupId,
					ids.reduce((sum, id) => sum + (quantities.get(id) ?? 0), 0),
				]),
			),
		}));
		const groupMarginals = new Map(
			[
				...occurrenceIdsByGroup.keys(),
			].map((groupId) => [
				groupId,
				marginal(groupDistribution, (quantities) => quantities.get(groupId) ?? 0),
			]),
		);
		return {
			compilation: "complete",
			occurrences: drafts.map((draft) => ({
				...draft,
				occurrenceQuantityDistribution: marginal(
					occurrenceDistribution,
					(quantities) => quantities.get(draft.id) ?? 0,
				),
				quantityDistribution: groupMarginals.get(draft.operationOutputGroupId) ?? [],
			})),
			outputDistribution: normalize(groupDistribution).map(({ probability, quantities }) => ({
				probability,
				quantities: [
					...quantities,
				]
					.filter(([, quantity]) => quantity > 0)
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([outputGroupId, quantity]) => ({
						outputGroupId,
						quantity,
					})),
			})),
		} satisfies EditorAcquisitionOutputModel;
	}),
);
