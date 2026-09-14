import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import { readRollDropsFn } from "~/production-output/fn/readRollDropsFn";

export type DraftRoll =
	| RollSchema.Type
	| {
			readonly type?: undefined;
	  };

/** Keeps authoring summaries empty until a new roll receives its required type. */
export const readDraftRollDropsFn = (roll: DraftRoll): readonly DropSchema.Type[] =>
	roll.type === undefined ? [] : readRollDropsFn(roll);
