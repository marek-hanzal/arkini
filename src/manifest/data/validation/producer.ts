import { match } from "ts-pattern";
import type { ItemId } from "../manifestId";
import type { ItemDefinition } from "../item";
import { assert } from "./assert";
import { assertQuantity } from "./quantity";

export function assertProducerDefinition(item: ItemDefinition, itemIds: Set<ItemId>) {
	const producer = item.producer;
	if (!producer) return;

	assert(Boolean(producer.cooldownMs), `${item.id} click producer must define cooldownMs`);
	assert(producer.output.length > 0, `${item.id} producer must have output`);

	for (const output of producer.output) {
		match(output)
			.with(
				{
					type: "guaranteed",
				},
				(entry) => {
					assert(
						itemIds.has(entry.itemId),
						`${item.id} outputs missing item ${entry.itemId}`,
					);
					if (entry.quantity !== undefined)
						assertQuantity(entry.quantity, `${item.id} guaranteed quantity`);
				},
			)
			.with(
				{
					type: "chance",
				},
				(entry) => {
					assert(
						itemIds.has(entry.itemId),
						`${item.id} outputs missing item ${entry.itemId}`,
					);
					assert(
						entry.probability >= 0 && entry.probability <= 1,
						`${item.id} chance probability must be between 0 and 1`,
					);
					if (entry.quantity !== undefined)
						assertQuantity(entry.quantity, `${item.id} chance quantity`);
				},
			)
			.with(
				{
					type: "weighted",
				},
				(entry) => {
					assert(
						entry.entries.length > 0,
						`${item.id} weighted output must have entries`,
					);
					if (entry.rolls !== undefined)
						assertQuantity(entry.rolls, `${item.id} weighted rolls`);

					for (const weightedEntry of entry.entries) {
						assert(
							weightedEntry.weight > 0,
							`${item.id} weighted output must be positive`,
						);
						if (weightedEntry.itemId) {
							assert(
								itemIds.has(weightedEntry.itemId),
								`${item.id} outputs missing item ${weightedEntry.itemId}`,
							);
						}
						if (weightedEntry.quantity !== undefined) {
							assertQuantity(weightedEntry.quantity, `${item.id} weighted quantity`);
						}
					}
				},
			)
			.exhaustive();
	}

	match(
		producer.mode ?? {
			type: "infinite" as const,
		},
	)
		.with(
			{
				type: "infinite",
			},
			() => undefined,
		)
		.with(
			{
				type: "finite",
			},
			(mode) => {
				assert(mode.charges > 0, `${item.id} finite charges must be positive`);
				if (typeof mode.onDepleted !== "string") {
					assert(
						itemIds.has(mode.onDepleted.replaceWithItemId),
						`${item.id} replacement item is missing`,
					);
				}
			},
		)
		.exhaustive();
}
