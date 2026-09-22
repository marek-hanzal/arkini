import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { RollSchema } from "~/outcome/schema/RollSchema";
import { readRollOutcomesFn } from "~/outcome/fn/readRollOutcomesFn";

export type DraftRoll =
	| RollSchema.Type
	| {
			readonly type?: undefined;
	  };

/** Keeps authoring summaries empty until a new roll receives its required type. */
export const readDraftRollOutcomesFn = (roll: DraftRoll): readonly OutcomeSchema.Type[] =>
	roll.type === undefined ? [] : readRollOutcomesFn(roll);
