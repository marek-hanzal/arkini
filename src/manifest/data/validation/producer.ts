import { match } from "ts-pattern";
import type { ItemDefinition } from "../item";
import type { ActivationDefinition, ActivationOutput } from "../producer";
import type { ItemId } from "../manifestId";
import { assert } from "./assert";
import { assertQuantity } from "./quantity";

export function assertProducerDefinition(item: ItemDefinition, itemIds: Set<ItemId>) {
	assertActivationDefinition(item.id, item.producer, itemIds, "producer");
	assertActivationDefinition(item.id, item.stash, itemIds, "stash");
}

function assertActivationDefinition(
	itemId: string,
	activation: ActivationDefinition | undefined,
	itemIds: Set<ItemId>,
	kind: "producer" | "stash",
) {
	if (!activation) return;

	if (kind === "producer") {
		assert(activation.type === "producer", `${itemId} producer must have producer type`);
		assert(Boolean(activation.cooldownMs), `${itemId} click producer must define cooldownMs`);
	} else {
		assert(activation.type === "stash", `${itemId} stash must have stash type`);
		assert(activation.charges > 0, `${itemId} stash charges must be positive`);
		if (typeof activation.onDepleted !== "string") {
			assert(
				itemIds.has(activation.onDepleted.replaceWithItemId),
				`${itemId} replacement item is missing`,
			);
		}
	}

	assert(activation.output.length > 0, `${itemId} ${kind} must have output`);
	for (const output of activation.output) assertOutput(itemId, kind, output, itemIds);
}

function assertOutput(
	itemId: string,
	kind: string,
	output: ActivationOutput,
	itemIds: Set<ItemId>,
) {
	match(output)
		.with(
			{
				type: "guaranteed",
			},
			(entry) => {
				assert(itemIds.has(entry.itemId), `${itemId} outputs missing item ${entry.itemId}`);
				if (entry.quantity !== undefined)
					assertQuantity(entry.quantity, `${itemId} guaranteed quantity`);
			},
		)
		.with(
			{
				type: "chance",
			},
			(entry) => {
				assert(itemIds.has(entry.itemId), `${itemId} outputs missing item ${entry.itemId}`);
				assert(
					entry.probability >= 0 && entry.probability <= 1,
					`${itemId} chance probability must be between 0 and 1`,
				);
				if (entry.quantity !== undefined)
					assertQuantity(entry.quantity, `${itemId} chance quantity`);
			},
		)
		.with(
			{
				type: "weighted",
			},
			(entry) => {
				assert(entry.entries.length > 0, `${itemId} weighted output must have entries`);
				if (entry.rolls !== undefined)
					assertQuantity(entry.rolls, `${itemId} weighted rolls`);
				for (const weightedEntry of entry.entries) {
					assert(weightedEntry.weight > 0, `${itemId} weighted output must be positive`);
					if (weightedEntry.itemId) {
						assert(
							itemIds.has(weightedEntry.itemId),
							`${itemId} outputs missing item ${weightedEntry.itemId}`,
						);
					}
					if (weightedEntry.quantity !== undefined) {
						assertQuantity(weightedEntry.quantity, `${itemId} weighted quantity`);
					}
				}
			},
		)
		.exhaustive();
}
