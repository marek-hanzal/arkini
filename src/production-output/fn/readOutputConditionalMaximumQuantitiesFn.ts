import { match } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { RollTypeSchema } from "~/production-output/schema/RollTypeSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import type { OutputSchema } from "../schema/OutputSchema";
import { readDropMaximumQuantitiesFn } from "./readDropMaximumQuantitiesFn";
import { readRollMaximumQuantitiesFn } from "~/production-output/fn/readRollMaximumQuantitiesFn";

const addQuantitiesFn = (
	target: Map<IdSchema.Type, number>,
	source: ReadonlyMap<IdSchema.Type, number>,
) => {
	for (const [itemId, quantity] of source) {
		target.set(itemId, (target.get(itemId) ?? 0) + quantity);
	}
};

const maximizeQuantitiesFn = (
	target: Map<IdSchema.Type, number>,
	source: ReadonlyMap<IdSchema.Type, number>,
) => {
	for (const [itemId, quantity] of source) {
		target.set(itemId, Math.max(target.get(itemId) ?? 0, quantity));
	}
};

const readRollConditionalMaximumQuantitiesFn = ({
	requiredItemId,
	roll,
}: {
	readonly requiredItemId: IdSchema.Type;
	readonly roll: RollSchema.Type;
}) => {
	return match(roll)
		.with(
			{
				type: RollTypeSchema.enum.Guaranteed,
			},
			{
				type: RollTypeSchema.enum.Chance,
			},
			(roll) => {
				if (roll.type === RollTypeSchema.enum.Chance && roll.chance === 0) {
					return undefined;
				}
				const quantities = readDropMaximumQuantitiesFn({
					drop: roll.drop,
				});
				return quantities.has(requiredItemId) ? quantities : undefined;
			},
		)
		.with(
			{
				type: RollTypeSchema.enum.Weight,
			},
			(roll) => {
				const selectionCount = roll.quantity.max;
				const candidates = roll.drop.map(({ drop }) =>
					readDropMaximumQuantitiesFn({
						drop,
					}),
				);
				const required = candidates.filter((candidate) => candidate.has(requiredItemId));
				if (required.length === 0) return undefined;

				const perSelectionMaximum = new Map<IdSchema.Type, number>();
				for (const candidate of candidates) {
					maximizeQuantitiesFn(perSelectionMaximum, candidate);
				}
				const conditional = new Map<IdSchema.Type, number>();
				for (const requiredCandidate of required) {
					const branch = new Map(requiredCandidate);
					for (const [itemId, quantity] of perSelectionMaximum) {
						branch.set(
							itemId,
							(branch.get(itemId) ?? 0) + quantity * (selectionCount - 1),
						);
					}
					maximizeQuantitiesFn(conditional, branch);
				}
				return conditional;
			},
		)
		.exhaustive();
};

export namespace readOutputConditionalMaximumQuantitiesFn {
	export interface Props {
		readonly output: OutputSchema.Type;
		readonly requiredItemId: IdSchema.Type;
	}
}

/**
 * Reads per-item maxima only across realizable output branches that also emit
 * the required item. Alternative sets and weighted choices remain correlated.
 */
export const readOutputConditionalMaximumQuantitiesFn = ({
	output,
	requiredItemId,
}: readOutputConditionalMaximumQuantitiesFn.Props) => {
	const outputMaximum = new Map<IdSchema.Type, number>();

	for (const set of output.set) {
		const unconditional = set.roll.map((roll) =>
			readRollMaximumQuantitiesFn({
				roll,
			}),
		);
		for (const [providerIndex, roll] of set.roll.entries()) {
			const provider = readRollConditionalMaximumQuantitiesFn({
				requiredItemId,
				roll,
			});
			if (provider === undefined) continue;
			const branch = new Map(provider);
			for (const [rollIndex, quantities] of unconditional.entries()) {
				if (rollIndex !== providerIndex) addQuantitiesFn(branch, quantities);
			}
			maximizeQuantitiesFn(outputMaximum, branch);
		}
	}

	return outputMaximum.size === 0 ? undefined : outputMaximum;
};
