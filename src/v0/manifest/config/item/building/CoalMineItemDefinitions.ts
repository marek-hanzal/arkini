import type { ItemDefinition } from "../../../item";
import { clickProducer } from "../../../dsl/clickProducer";
import { producerInput } from "../../../dsl/producerInput";
import { item } from "../../../dsl/item";

export const CoalMineItemDefinitions = [
	item({
		id: "item:coal-mine-1",
		assetId: "asset:item-coal-mine",
		code: "coal-mine-1",
		name: "Coal Mine I",
		tier: 1,
		maxStackSize: 1,
		description:
			"Produces coal only after it receives sausage and beer. Labor relations remain advanced nonsense.",
		tags: [
			"producer",
			"building",
			"fuel",
		],
		sort: 392,
		behavior: {
			label: "1",
			producer: clickProducer({
				cooldownMs: 5200,
				outputTableId: "loot:coal-mine-1",
				inputs: [
					producerInput({
						itemId: "item:sausage",
						quantity: 1,
						capacity: 4,
					}),
					producerInput({
						itemId: "item:beer",
						quantity: 1,
						capacity: 4,
					}),
				],
			}),
		},
	}),
] satisfies ItemDefinition[];
