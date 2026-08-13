import { Effect } from "effect";

import { outputFx } from "~/engine/output/fx/outputFx";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { RollEnumSchema } from "~/engine/roll/schema/RollEnumSchema";

const minimizeDropQuantity = (drop: DropSchema.Type): DropSchema.Type => ({
	...drop,
	quantity: {
		max: drop.quantity.min,
		min: drop.quantity.min,
	},
});

const readGuaranteedDrops = (output: OutputSchema.Type) => {
	const set = output.set.length === 1 ? output.set[0] : undefined;
	if (set === undefined) return [];
	return set.roll.flatMap((roll): ReadonlyArray<DropSchema.Type> => {
		switch (roll.type) {
			case RollEnumSchema.enum.Guaranteed:
				return roll.drop.map(minimizeDropQuantity);
			case RollEnumSchema.enum.Chance:
				return roll.chance === 1 ? roll.drop.map(minimizeDropQuantity) : [];
			case RollEnumSchema.enum.Weight:
				return [];
		}
	});
};

/**
 * Resolves only the authored output floor that is guaranteed independently of random choices.
 *
 * A planner baseline action must never become feasible merely because its stable random seed hit a
 * chance sibling. Alternative sets and weighted rolls therefore emit nothing here. Guaranteed and
 * probability-one drops from a single set emit their minimum quantity; positive-probability
 * branches remain available exclusively through an explicit planner witness.
 */
export const resolvePlannerGuaranteedOutputFx = Effect.fn("resolvePlannerGuaranteedOutputFx")(
	function* ({ origin, output }: outputFx.Props) {
		const drops = readGuaranteedDrops(output);
		const first = drops[0];
		if (first === undefined)
			return {
				drop: [],
			};

		const guaranteedOutput: OutputSchema.Type = {
			set: [
				{
					roll: [
						{
							drop: [
								first,
								...drops.slice(1),
							],
							type: RollEnumSchema.enum.Guaranteed,
						},
					],
					weight: 1,
				},
			],
		};
		return yield* outputFx({
			origin,
			output: guaranteedOutput,
		});
	},
);
