import { Effect } from "effect";

import type {
	EditorAcquisitionOutputAnnotation,
	EditorAcquisitionRequirement,
	EditorAcquisitionUnsupportedRequirement,
} from "~/editor/EditorAcquisitionGraph";
import { readEditorAcquisitionAvailabilityRequirementsFn } from "~/editor/acquisition/fn/readEditorAcquisitionAvailabilityRequirementsFn";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";

interface OutputOccurrence {
	readonly annotation: EditorAcquisitionOutputAnnotation;
	readonly expectedYield: number;
	readonly factId: string;
	readonly id: string;
	readonly requirements: {
		readonly allOf: ReadonlyArray<EditorAcquisitionRequirement>;
		readonly anyOf: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
		readonly unsupported?: ReadonlyArray<EditorAcquisitionUnsupportedRequirement>;
	};
}

interface EditorAcquisitionOutputModel {
	readonly occurrences: ReadonlyArray<OutputOccurrence>;
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

const meanQuantity = ({ max, min }: DropSchema.Type["quantity"]) => (min + max) / 2;

/** Projects authored output occurrences into scalar expected yields. */
export const readEditorAcquisitionOutputOccurrencesFx = Effect.fn(
	"readEditorAcquisitionOutputOccurrencesFx",
)((output: OutputSchema.Type | undefined) =>
	Effect.gen(function* () {
		if (output === undefined)
			return {
				occurrences: [],
			} satisfies EditorAcquisitionOutputModel;

		const drafts: Array<
			OutputOccurrence & {
				readonly groupId: string;
			}
		> = [];
		const groupByKey = new Map<string, string>();
		const readDrop = (
			drop: DropSchema.Type,
			id: string,
			annotation: EditorAcquisitionOutputAnnotation,
			probability: number,
		) => {
			const requirements = readEditorAcquisitionAvailabilityRequirementsFn({
				rules: drop.rules,
				source: "output-condition",
			});
			const key = `${drop.itemId}\u0000${requirementKey(requirements)}`;
			const groupId = groupByKey.get(key) ?? `output:${groupByKey.size}`;
			groupByKey.set(key, groupId);
			drafts.push({
				annotation,
				expectedYield: probability * meanQuantity(drop.quantity),
				factId: drop.itemId,
				groupId,
				id,
				requirements,
			});
		};

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
					const expectedSelections = (roll.quantity.min + roll.quantity.max) / 2;
					for (const [candidateIndex, candidate] of roll.drop.entries()) {
						for (const [dropIndex, drop] of candidate.drop.entries()) {
							const id = `set:${setIndex}:roll:${rollIndex}:candidate:${candidateIndex}:drop:${dropIndex}`;
							readDrop(
								drop,
								id,
								{
									alternativeSet: output.set.length > 1,
									placement: drop.placement,
									quantity: drop.quantity,
									selectionKind: "weighted",
								},
								setProbability *
									expectedSelections *
									(candidate.weight / totalWeight),
							);
						}
					}
				} else {
					for (const [dropIndex, drop] of roll.drop.entries()) {
						const id = `set:${setIndex}:roll:${rollIndex}:drop:${dropIndex}`;
						readDrop(
							drop,
							id,
							{
								alternativeSet: output.set.length > 1,
								placement: drop.placement,
								quantity: drop.quantity,
								selectionKind: roll.type,
							},
							setProbability * (roll.type === "chance" ? roll.chance : 1),
						);
					}
				}
			}
		}

		const expectedYieldByGroupId = new Map<string, number>();
		for (const draft of drafts) {
			expectedYieldByGroupId.set(
				draft.groupId,
				(expectedYieldByGroupId.get(draft.groupId) ?? 0) + draft.expectedYield,
			);
		}
		return {
			occurrences: drafts.map(({ groupId, ...draft }) => ({
				...draft,
				expectedYield: expectedYieldByGroupId.get(groupId) ?? 0,
			})),
		} satisfies EditorAcquisitionOutputModel;
	}),
);
