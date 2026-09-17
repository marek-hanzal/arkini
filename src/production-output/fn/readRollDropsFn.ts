import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";

/** Enumerates every authored drop, without resolving a roll. */
export const readRollDropsFn = (roll: RollSchema.Type): readonly DropSchema.Type[] => roll.drop;
