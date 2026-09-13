import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";

/** Enumerates every authored drop, including all weighted candidates, without resolving a roll. */
export const readRollDropsFn = (roll: RollSchema.Type): readonly DropSchema.Type[] =>
	roll.type === "weight" ? roll.drop.flatMap((candidate) => candidate.drop) : roll.drop;
