import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { RollEnumSchema } from "~/engine/roll/schema/RollEnumSchema";

export type OutputRecreationCertainty = "guaranteed" | "stochastic" | "none";

const readDropCertainty = (
	drops: ReadonlyArray<DropSchema.Type>,
	itemId: IdSchema.Type,
): OutputRecreationCertainty => {
	const matching = drops.filter((drop) => drop.itemId === itemId);
	if (matching.length === 0) return "none";
	return matching.some((drop) => drop.rules.length === 0) ? "guaranteed" : "stochastic";
};

/**
 * Classifies only obvious output certainty for one item.
 *
 * This intentionally does not solve reachability or economic cycles. It merely
 * distinguishes deterministic configured recreation from chance/weight/rule
 * paths that may fail, plus paths that can never emit the item.
 */
export const readOutputRecreationCertaintyFx = Effect.fn("readOutputRecreationCertaintyFx")(
	function* (output: OutputSchema.Type, itemId: IdSchema.Type) {
		const sets = output.set.map((set) => {
			const rolls = set.roll.map((roll): OutputRecreationCertainty => {
				if (roll.type === RollEnumSchema.enum.Guaranteed) {
					return readDropCertainty(roll.drop, itemId);
				}
				if (roll.type === RollEnumSchema.enum.Chance) {
					if (roll.chance === 0) return "none";
					const drop = readDropCertainty(roll.drop, itemId);
					if (drop === "none") return "none";
					return roll.chance === 1 && drop === "guaranteed" ? "guaranteed" : "stochastic";
				}

				const candidates = roll.drop.map((candidate) =>
					readDropCertainty(candidate.drop, itemId),
				);
				if (candidates.every((candidate) => candidate === "guaranteed")) {
					return "guaranteed";
				}
				return candidates.some((candidate) => candidate !== "none") ? "stochastic" : "none";
			});

			if (rolls.some((roll) => roll === "guaranteed")) return "guaranteed" as const;
			if (rolls.some((roll) => roll === "stochastic")) return "stochastic" as const;
			return "none" as const;
		});

		if (sets.every((set) => set === "guaranteed")) return "guaranteed";
		if (sets.some((set) => set !== "none")) return "stochastic";
		return "none";
	},
);
