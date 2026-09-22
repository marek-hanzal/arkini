import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { RollSchema } from "~/outcome/schema/RollSchema";

/** Enumerates every authored outcome, without resolving a roll. */
export const readRollOutcomesFn = (roll: RollSchema.Type): readonly OutcomeSchema.Type[] =>
	roll.outcome;
