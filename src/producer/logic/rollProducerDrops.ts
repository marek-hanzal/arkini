import type { ItemId } from "~/manifest/data/manifestId";
import type { ProducerOutput, ProducerWeightedEntry } from "~/manifest/data/producer";
import { pickWeightedProducerDrop } from "~/producer/logic/pickWeightedProducerDrop";
import { resolveProducerDropQuantity } from "~/producer/logic/resolveProducerDropQuantity";

export function rollProducerDrops(outputs: readonly ProducerOutput[]) {
	return outputs.flatMap((output) => {
		switch (output.type) {
			case "guaranteed":
				return repeatItem(output.itemId, resolveProducerDropQuantity(output.quantity ?? 1));
			case "chance":
				return Math.random() <= output.probability
					? repeatItem(output.itemId, resolveProducerDropQuantity(output.quantity ?? 1))
					: [];
			case "weighted":
				return rollWeightedDrops(
					output.entries,
					resolveProducerDropQuantity(output.rolls ?? 1),
				);
		}
	});
}

function rollWeightedDrops(entries: readonly ProducerWeightedEntry[], rolls: number) {
	return Array.from(
		{
			length: rolls,
		},
		() => pickWeightedProducerDrop(entries),
	).flatMap((entry) => {
		if (!entry.itemId) return [];
		return repeatItem(entry.itemId, resolveProducerDropQuantity(entry.quantity ?? 1));
	});
}

function repeatItem(itemId: ItemId, quantity: number) {
	return Array.from(
		{
			length: quantity,
		},
		() => itemId,
	);
}
