import { Effect } from "effect";

import type { OutputSelectionWitness } from "~/engine/output/OutputSelectionWitness";
import { outputFx } from "~/engine/output/fx/outputFx";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { RollEnumSchema } from "~/engine/roll/schema/RollEnumSchema";

const readWitnessDrop = ({
	output,
	witness,
}: {
	readonly output: OutputSchema.Type;
	readonly witness: OutputSelectionWitness;
}) => {
	const set = output.set[witness.setIndex];
	if (set === undefined)
		throw new RangeError(`Planner output witness set ${witness.setIndex} is missing.`);
	const roll = set.roll[witness.rollIndex];
	if (roll === undefined)
		throw new RangeError(`Planner output witness roll ${witness.rollIndex} is missing.`);

	const candidate =
		roll.type === RollEnumSchema.enum.Weight
			? witness.candidateIndex === undefined
				? undefined
				: roll.drop[witness.candidateIndex]
			: undefined;
	if (roll.type === RollEnumSchema.enum.Weight && candidate === undefined)
		throw new RangeError(
			`Planner weighted output witness candidate ${String(witness.candidateIndex)} is missing.`,
		);
	if (roll.type !== RollEnumSchema.enum.Weight && witness.candidateIndex !== undefined)
		throw new RangeError("Planner non-weighted output witness has a candidate index.");

	const drop =
		roll.type === RollEnumSchema.enum.Weight
			? candidate?.drop[witness.dropIndex]
			: roll.drop[witness.dropIndex];
	if (drop === undefined)
		throw new RangeError(`Planner output witness drop ${witness.dropIndex} is missing.`);
	if (drop.itemId !== witness.itemId)
		throw new RangeError(
			`Planner output witness expected ${witness.itemId}, received ${drop.itemId}.`,
		);
	if (roll.type === RollEnumSchema.enum.Chance && roll.chance === 0)
		throw new RangeError("Planner output witness cannot select a zero-chance roll.");

	return {
		roll,
		set,
	};
};

const maximizeDropQuantity = (drop: DropSchema.Type): DropSchema.Type => ({
	...drop,
	quantity: {
		max: drop.quantity.max,
		min: drop.quantity.max,
	},
});

/** Reads the exact maximal integer drops emitted by one planner witness branch. */
export const readPlannerOutputWitnessDrops = ({
	output,
	witness,
}: {
	readonly output: OutputSchema.Type;
	readonly witness: OutputSelectionWitness;
}) => {
	const { set } = readWitnessDrop({
		output,
		witness,
	});
	const drops: DropSchema.Type[] = [];

	for (const [rollIndex, roll] of set.roll.entries()) {
		const targeted = rollIndex === witness.rollIndex;
		switch (roll.type) {
			case RollEnumSchema.enum.Guaranteed:
				drops.push(...roll.drop);
				break;
			case RollEnumSchema.enum.Chance:
				if (targeted || roll.chance === 1) drops.push(...roll.drop);
				break;
			case RollEnumSchema.enum.Weight: {
				const candidate = targeted ? roll.drop[witness.candidateIndex ?? -1] : roll.drop[0];
				if (candidate === undefined)
					throw new RangeError("Planner weighted output candidate is missing.");
				const selections = targeted ? roll.quantity.max : roll.quantity.min;
				for (let index = 0; index < selections; index += 1) drops.push(...candidate.drop);
				break;
			}
		}
	}

	return drops.map(maximizeDropQuantity);
};

/** Resolves one concrete positive-probability branch containing the selected output occurrence. */
export const resolvePlannerOutputWitnessFx = Effect.fn("resolvePlannerOutputWitnessFx")(function* ({
	origin,
	output,
	witness,
}: outputFx.Props & {
	readonly witness: OutputSelectionWitness;
}) {
	const drops = readPlannerOutputWitnessDrops({
		output,
		witness,
	});
	const first = drops[0];
	if (first === undefined)
		return yield* Effect.die(new Error("Planner output witness selected no drops."));

	const concreteOutput: OutputSchema.Type = {
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
		output: concreteOutput,
	});
});
