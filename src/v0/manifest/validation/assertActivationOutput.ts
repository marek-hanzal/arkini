import { match } from "ts-pattern";
import type { ItemId } from "../manifestId";
import type { ActivationOutput } from "../producer";
import { assert } from "./assert";
import { assertQuantity } from "./quantity";

export const assertActivationOutput = (
	ownerId: string,
	output: ActivationOutput,
	itemIds: Set<ItemId>,
) => {
	match(output)
		.with(
			{
				type: "guaranteed",
			},
			(entry) => {
				assert(
					itemIds.has(entry.itemId),
					`${ownerId} outputs missing item ${entry.itemId}`,
				);
				if (entry.quantity !== undefined)
					assertQuantity(entry.quantity, `${ownerId} guaranteed quantity`);
			},
		)
		.with(
			{
				type: "chance",
			},
			(entry) => {
				assert(
					itemIds.has(entry.itemId),
					`${ownerId} outputs missing item ${entry.itemId}`,
				);
				assert(
					entry.probability > 0 && entry.probability <= 1,
					`${ownerId} chance probability must be between 0 and 1`,
				);
				if (entry.quantity !== undefined)
					assertQuantity(entry.quantity, `${ownerId} chance quantity`);
			},
		)
		.with(
			{
				type: "weighted",
			},
			(entry) => {
				assert(entry.entries.length > 0, `${ownerId} weighted output must have entries`);
				if (entry.rolls !== undefined)
					assertQuantity(entry.rolls, `${ownerId} weighted rolls`);
				for (const weightedEntry of entry.entries) {
					assert(weightedEntry.weight > 0, `${ownerId} weighted output must be positive`);
					assert(
						itemIds.has(weightedEntry.itemId),
						`${ownerId} outputs missing item ${weightedEntry.itemId}`,
					);
					if (weightedEntry.quantity !== undefined) {
						assertQuantity(weightedEntry.quantity, `${ownerId} weighted quantity`);
					}
				}
			},
		)
		.exhaustive();
};
