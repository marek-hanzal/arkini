import type { ItemId } from "../manifestId";
import type { ActivationDefinition } from "../producer";
import { assert } from "./assert";

export const assertActivationDefinition = (
	itemId: string,
	activation: ActivationDefinition | undefined,
	itemIds: Set<ItemId>,
	kind: "producer" | "stash",
) => {
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
};
