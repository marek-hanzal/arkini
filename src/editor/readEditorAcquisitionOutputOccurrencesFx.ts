import { Effect } from "effect";

import {
	createEditorAcquisitionBoundedDistributionFx,
	type EditorAcquisitionDistribution,
} from "~/editor/createEditorAcquisitionBoundedDistributionFx";

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

/** Translates authored output schema into occurrence and group distributions. */
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
		const boundedDistribution = yield* createEditorAcquisitionBoundedDistributionFx();

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
			if (!Number.isSafeInteger(count) || count > boundedDistribution.maximumOutcomeStates)
				return undefined;
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
			) satisfies EditorAcquisitionDistribution;
		});

		const totalSetWeight = output.set.reduce((total, set) => total + set.weight, 0);
		const setBranches: Array<{
			distribution: EditorAcquisitionDistribution;
			probability: number;
		}> = [];
		let unsupported = false;
		for (const [setIndex, set] of output.set.entries()) {
			let setDistribution: EditorAcquisitionDistribution | undefined =
				yield* boundedDistribution.constantFx(undefined, 0);
			for (const [rollIndex, roll] of set.roll.entries()) {
				if (roll.type === "chance" && roll.chance === 0) continue;
				let rollDistribution: EditorAcquisitionDistribution | undefined;
				if (roll.type === "weight") {
					const totalWeight = roll.drop.reduce(
						(total, candidate) => total + candidate.weight,
						0,
					);
					const candidates: Array<{
						distribution: EditorAcquisitionDistribution;
						probability: number;
					}> = [];
					for (const [candidateIndex, candidate] of roll.drop.entries()) {
						let candidateDistribution: EditorAcquisitionDistribution | undefined =
							yield* boundedDistribution.constantFx(undefined, 0);
						for (const [dropIndex, drop] of candidate.drop.entries()) {
							const id = `set:${setIndex}:roll:${rollIndex}:candidate:${candidateIndex}:drop:${dropIndex}`;
							candidateDistribution = yield* boundedDistribution.convolveFx(
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
					const selection = unsupported
						? undefined
						: yield* boundedDistribution.mixFx(candidates);
					const count = roll.quantity.max - roll.quantity.min + 1;
					const repetitions: Array<{
						distribution: EditorAcquisitionDistribution;
						probability: number;
					}> = [];
					if (
						!Number.isSafeInteger(count) ||
						count > boundedDistribution.maximumOutcomeStates
					)
						rollDistribution = undefined;
					else {
						for (let index = 0; index < count; index += 1) {
							const distribution = yield* boundedDistribution.repeatFx(
								selection,
								roll.quantity.min + index,
							);
							if (distribution === undefined) break;
							repetitions.push({
								distribution,
								probability: 1 / count,
							});
						}
						rollDistribution =
							repetitions.length === count
								? yield* boundedDistribution.mixFx(repetitions)
								: undefined;
					}
				} else {
					let drops: EditorAcquisitionDistribution | undefined =
						yield* boundedDistribution.constantFx(undefined, 0);
					for (const [dropIndex, drop] of roll.drop.entries()) {
						const id = `set:${setIndex}:roll:${rollIndex}:drop:${dropIndex}`;
						drops = yield* boundedDistribution.convolveFx(
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
						roll.type === "chance"
							? yield* boundedDistribution.optionalFx(drops, roll.chance)
							: drops;
				}
				setDistribution = yield* boundedDistribution.convolveFx(
					setDistribution,
					rollDistribution,
				);
				if (setDistribution === undefined) unsupported = true;
			}
			if (setDistribution !== undefined)
				setBranches.push({
					distribution: setDistribution,
					probability: set.weight / totalSetWeight,
				});
		}

		const occurrenceDistribution = unsupported
			? undefined
			: yield* boundedDistribution.mixFx(setBranches);
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
		const groupMarginals = new Map<
			string,
			ReadonlyArray<EditorAcquisitionQuantityProbability>
		>();
		for (const groupId of occurrenceIdsByGroup.keys())
			groupMarginals.set(
				groupId,
				yield* boundedDistribution.marginalFx(
					groupDistribution,
					(quantities) => quantities.get(groupId) ?? 0,
				),
			);
		const occurrenceMarginals = new Map<
			string,
			ReadonlyArray<EditorAcquisitionQuantityProbability>
		>();
		for (const draft of drafts)
			occurrenceMarginals.set(
				draft.id,
				yield* boundedDistribution.marginalFx(
					occurrenceDistribution,
					(quantities) => quantities.get(draft.id) ?? 0,
				),
			);
		const normalizedGroupDistribution =
			yield* boundedDistribution.normalizeFx(groupDistribution);
		return {
			compilation: "complete",
			occurrences: drafts.map((draft) => ({
				...draft,
				occurrenceQuantityDistribution: occurrenceMarginals.get(draft.id) ?? [],
				quantityDistribution: groupMarginals.get(draft.operationOutputGroupId) ?? [],
			})),
			outputDistribution: normalizedGroupDistribution.map(({ probability, quantities }) => ({
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
