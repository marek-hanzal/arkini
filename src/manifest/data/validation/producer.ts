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

export function assertActivationOutput(
	ownerId: string,
	output: ActivationOutput,
	itemIds: Set<ItemId>,
) {
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

	for (const input of activation.inputs ?? []) {
		assert(
			itemIds.has(input.itemId),
			`${itemId} input references missing item ${input.itemId}`,
		);
		assert(input.capacity >= input.quantity, `${itemId} input capacity must cover quantity`);
	}
}
