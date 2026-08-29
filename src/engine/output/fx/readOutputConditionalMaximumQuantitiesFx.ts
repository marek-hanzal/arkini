import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { TypeSchema } from "~/engine/roll/schema/TypeSchema";
import type { RollSchema } from "~/engine/roll/schema/RollSchema";
import type { OutputSchema } from "../schema/OutputSchema";
import { readDropMaximumQuantitiesFx } from "./readDropMaximumQuantitiesFx";
import { readRollMaximumQuantitiesFx } from "~/engine/roll/fx/readRollMaximumQuantitiesFx";

const addQuantities = (
	target: Map<IdSchema.Type, number>,
	source: ReadonlyMap<IdSchema.Type, number>,
) => {
	for (const [itemId, quantity] of source) {
		target.set(itemId, (target.get(itemId) ?? 0) + quantity);
	}
};

const maximizeQuantities = (
	target: Map<IdSchema.Type, number>,
	source: ReadonlyMap<IdSchema.Type, number>,
) => {
	for (const [itemId, quantity] of source) {
		target.set(itemId, Math.max(target.get(itemId) ?? 0, quantity));
	}
};

const readRollConditionalMaximumQuantitiesFx = Effect.fn("readRollConditionalMaximumQuantitiesFx")(
	function* ({
		requiredItemId,
		roll,
	}: {
		readonly requiredItemId: IdSchema.Type;
		readonly roll: RollSchema.Type;
	}) {
		return yield* match(roll)
			.with(
				{
					type: TypeSchema.enum.Guaranteed,
				},
				{
					type: TypeSchema.enum.Chance,
				},
				(roll) =>
					Effect.gen(function* () {
						if (roll.type === TypeSchema.enum.Chance && roll.chance === 0) {
							return undefined;
						}
						const quantities = yield* readDropMaximumQuantitiesFx({
							drop: roll.drop,
						});
						return quantities.has(requiredItemId) ? quantities : undefined;
					}),
			)
			.with(
				{
					type: TypeSchema.enum.Weight,
				},
				(roll) =>
					Effect.gen(function* () {
						const selectionCount = roll.quantity.max;
						const candidates = yield* Effect.all(
							roll.drop.map(({ drop }) =>
								readDropMaximumQuantitiesFx({
									drop,
								}),
							),
						);
						const required = candidates.filter((candidate) =>
							candidate.has(requiredItemId),
						);
						if (required.length === 0) return undefined;

						const perSelectionMaximum = new Map<IdSchema.Type, number>();
						for (const candidate of candidates) {
							maximizeQuantities(perSelectionMaximum, candidate);
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
							maximizeQuantities(conditional, branch);
						}
						return conditional;
					}),
			)
			.exhaustive();
	},
);

export namespace readOutputConditionalMaximumQuantitiesFx {
	export interface Props {
		readonly output: OutputSchema.Type;
		readonly requiredItemId: IdSchema.Type;
	}
}

/**
 * Reads per-item maxima only across realizable output branches that also emit
 * the required item. Alternative sets and weighted choices remain correlated.
 */
export const readOutputConditionalMaximumQuantitiesFx = Effect.fn(
	"readOutputConditionalMaximumQuantitiesFx",
)(function* ({ output, requiredItemId }: readOutputConditionalMaximumQuantitiesFx.Props) {
	const outputMaximum = new Map<IdSchema.Type, number>();

	for (const set of output.set) {
		const unconditional = yield* Effect.all(
			set.roll.map((roll) =>
				readRollMaximumQuantitiesFx({
					roll,
				}),
			),
		);
		for (const [providerIndex, roll] of set.roll.entries()) {
			const provider = yield* readRollConditionalMaximumQuantitiesFx({
				requiredItemId,
				roll,
			});
			if (provider === undefined) continue;
			const branch = new Map(provider);
			for (const [rollIndex, quantities] of unconditional.entries()) {
				if (rollIndex !== providerIndex) addQuantities(branch, quantities);
			}
			maximizeQuantities(outputMaximum, branch);
		}
	}

	return outputMaximum.size === 0 ? undefined : outputMaximum;
});
