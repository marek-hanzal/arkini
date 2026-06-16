import type { ItemDefinition } from "../../../item";
import { clickStash } from "../../../dsl/clickStash";
import { producerInput } from "../../../dsl/producerInput";
import { item } from "../../../dsl/item";

export const EpicCrateItemDefinitions = [
	item({
		id: "item:crate-4",
		assetId: "asset:item-crate-epic",
		code: "crate-4",
		name: "Epic Crate",
		tier: 4,
		maxStackSize: 1,
		description: "Purple box. The economy is doomed.",
		tags: [
			"producer",
			"container",
			"rare",
		],
		sort: 430,
		behavior: {
			stash: clickStash({
				charges: 6,
				outputTableId: "loot:crate-4",
				onDepleted: "remove",
				inputs: [
					producerInput({
						itemId: "item:epic-key",
						quantity: 1,
						capacity: 1,
					}),
				],
			}),
		},
	}),
] satisfies ItemDefinition[];
