import { Effect } from "effect";

import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { RollEnumSchema } from "~/engine/roll/schema/RollEnumSchema";

import type { OutputItemIdsSchema } from "../schema/OutputItemIdsSchema";

/** Reads every canonical item ID that any branch of one output may emit. */
export const readOutputItemIdsFx = Effect.fn("readOutputItemIdsFx")(function* (
	output: OutputSchema.Type,
) {
	const itemIds: OutputItemIdsSchema.Type = [];
	for (const set of output.set) {
		for (const roll of set.roll) {
			if (roll.type === RollEnumSchema.enum.Guaranteed || roll.type === RollEnumSchema.enum.Chance) {
				itemIds.push(...roll.drop.map(({ itemId }) => itemId));
				continue;
			}
			for (const candidate of roll.drop) {
				itemIds.push(...candidate.drop.map(({ itemId }) => itemId));
			}
		}
	}

	return itemIds;
});
