import type { ItemDefinition } from "../../item";
import { clickProducer } from "../../dsl/clickProducer";
import { imprint } from "../../dsl/imprint";
import { item } from "../../dsl/item";
import { producerInput } from "../../dsl/producerInput";

export const BuildingItemDefinitions = [
	item({
		id: "item:townhall-1",
		assetId: "asset:item-townhall",
		code: "townhall-1",
		name: "Town Hall I",
		tier: 1,
		maxStackSize: 1,
		description: "A tiny bureaucracy that spits out progress.",
		tags: [
			"producer",
			"building",
			"townhall",
		],
		sort: 300,
		behavior: {
			merge: [
				imprint({
					id: "merge:townhall-1-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-townhall",
				}),
			],
			label: "1",
			producer: clickProducer({
				cooldownMs: 3500,
				outputTableId: "loot:townhall-1",
			}),
		},
	}),
	item({
		id: "item:townhall-2",
		assetId: "asset:item-townhall",
		code: "townhall-2",
		name: "Town Hall II",
		tier: 2,
		maxStackSize: 1,
		description: "Same bureaucracy, slightly shinier clipboard.",
		tags: [
			"producer",
			"building",
			"townhall",
		],
		sort: 310,
		behavior: {
			merge: [
				imprint({
					id: "merge:townhall-2-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-townhall-2",
				}),
			],
			label: "2",
			producer: clickProducer({
				cooldownMs: 3000,
				outputTableId: "loot:townhall-2",
			}),
		},
	}),
	item({
		id: "item:townhall-3",
		assetId: "asset:item-townhall",
		code: "townhall-3",
		name: "Town Hall III",
		tier: 3,
		maxStackSize: 1,
		description: "Municipal paperwork with actual momentum.",
		tags: [
			"producer",
			"building",
			"townhall",
		],
		sort: 320,
		behavior: {
			merge: [
				imprint({
					id: "merge:townhall-3-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-townhall-3",
				}),
			],
			label: "3",
			producer: clickProducer({
				cooldownMs: 2500,
				outputTableId: "loot:townhall-3",
			}),
		},
	}),
	item({
		id: "item:townhall-4",
		assetId: "asset:item-townhall",
		code: "townhall-4",
		name: "Town Hall IV",
		tier: 4,
		maxStackSize: 1,
		description: "Bureaucracy with sparkles. Humanity had options.",
		tags: [
			"producer",
			"building",
			"townhall",
		],
		sort: 324,
		behavior: {
			merge: [
				imprint({
					id: "merge:townhall-4-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-townhall-4",
				}),
			],
			label: "4",
			producer: clickProducer({
				cooldownMs: 2200,
				outputTableId: "loot:townhall-4",
			}),
		},
	}),
	item({
		id: "item:townhall-5",
		assetId: "asset:item-townhall",
		code: "townhall-5",
		name: "Town Hall V",
		tier: 5,
		maxStackSize: 1,
		description: "A municipal beast with alarming confidence.",
		tags: [
			"producer",
			"building",
			"townhall",
		],
		sort: 328,
		behavior: {
			merge: [
				imprint({
					id: "merge:townhall-5-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-townhall-5",
				}),
			],
			label: "5",
			producer: clickProducer({
				cooldownMs: 1900,
				outputTableId: "loot:townhall-5",
			}),
		},
	}),
	item({
		id: "item:lumber-camp-1",
		assetId: "asset:item-lumber-camp",
		code: "lumber-camp-1",
		name: "Lumber Camp I",
		tier: 1,
		maxStackSize: 1,
		description: "A polite machine for turning time into sticks.",
		tags: [
			"producer",
			"building",
			"wood",
		],
		sort: 330,
		behavior: {
			merge: [
				imprint({
					id: "merge:lumber-camp-1-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-lumber-camp",
				}),
			],
			label: "1",
			producer: clickProducer({
				cooldownMs: 5000,
				outputTableId: "loot:lumber-camp-1",
			}),
		},
	}),
	item({
		id: "item:lumber-camp-2",
		assetId: "asset:item-lumber-camp",
		code: "lumber-camp-2",
		name: "Lumber Camp II",
		tier: 2,
		maxStackSize: 1,
		description: "Still wood, but now with ambition.",
		tags: [
			"producer",
			"building",
			"wood",
		],
		sort: 340,
		behavior: {
			merge: [
				imprint({
					id: "merge:lumber-camp-2-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-lumber-camp-2",
				}),
			],
			label: "2",
			producer: clickProducer({
				cooldownMs: 4500,
				outputTableId: "loot:lumber-camp-2",
			}),
		},
	}),
	item({
		id: "item:lumber-camp-3",
		assetId: "asset:item-lumber-camp",
		code: "lumber-camp-3",
		name: "Lumber Camp III",
		tier: 3,
		maxStackSize: 1,
		description: "A compact shrine to deforestation.",
		tags: [
			"producer",
			"building",
			"wood",
		],
		sort: 350,
		behavior: {
			merge: [
				imprint({
					id: "merge:lumber-camp-3-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-lumber-camp-3",
				}),
			],
			label: "3",
			producer: clickProducer({
				cooldownMs: 4000,
				outputTableId: "loot:lumber-camp-3",
			}),
		},
	}),
	item({
		id: "item:lumber-camp-4",
		assetId: "asset:item-lumber-camp",
		code: "lumber-camp-4",
		name: "Lumber Camp IV",
		tier: 4,
		maxStackSize: 1,
		description: "Deforestation, now with workflows.",
		tags: [
			"producer",
			"building",
			"wood",
		],
		sort: 354,
		behavior: {
			merge: [
				imprint({
					id: "merge:lumber-camp-4-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-lumber-camp-4",
				}),
			],
			label: "4",
			producer: clickProducer({
				cooldownMs: 3600,
				outputTableId: "loot:lumber-camp-4",
			}),
		},
	}),
	item({
		id: "item:lumber-camp-5",
		assetId: "asset:item-lumber-camp",
		code: "lumber-camp-5",
		name: "Lumber Camp V",
		tier: 5,
		maxStackSize: 1,
		description: "At this point the forest has filed a complaint.",
		tags: [
			"producer",
			"building",
			"wood",
		],
		sort: 358,
		behavior: {
			merge: [
				imprint({
					id: "merge:lumber-camp-5-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-lumber-camp-5",
				}),
			],
			label: "5",
			producer: clickProducer({
				cooldownMs: 3200,
				outputTableId: "loot:lumber-camp-5",
			}),
		},
	}),
	item({
		id: "item:quarry-1",
		assetId: "asset:item-quarry",
		code: "quarry-1",
		name: "Quarry I",
		tier: 1,
		maxStackSize: 1,
		description: "A hole in the ground with a business model.",
		tags: [
			"producer",
			"building",
			"stone",
		],
		sort: 360,
		behavior: {
			merge: [
				imprint({
					id: "merge:quarry-1-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-quarry",
				}),
			],
			label: "1",
			producer: clickProducer({
				cooldownMs: 5500,
				outputTableId: "loot:quarry-1",
			}),
		},
	}),
	item({
		id: "item:quarry-2",
		assetId: "asset:item-quarry",
		code: "quarry-2",
		name: "Quarry II",
		tier: 2,
		maxStackSize: 1,
		description: "A deeper hole, because progress is weird.",
		tags: [
			"producer",
			"building",
			"stone",
		],
		sort: 370,
		behavior: {
			merge: [
				imprint({
					id: "merge:quarry-2-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-quarry-2",
				}),
			],
			label: "2",
			producer: clickProducer({
				cooldownMs: 5000,
				outputTableId: "loot:quarry-2",
			}),
		},
	}),
	item({
		id: "item:quarry-3",
		assetId: "asset:item-quarry",
		code: "quarry-3",
		name: "Quarry III",
		tier: 3,
		maxStackSize: 1,
		description: "Rocks leaving the earth at startup velocity.",
		tags: [
			"producer",
			"building",
			"stone",
		],
		sort: 380,
		behavior: {
			merge: [
				imprint({
					id: "merge:quarry-3-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-quarry-3",
				}),
			],
			label: "3",
			producer: clickProducer({
				cooldownMs: 4500,
				outputTableId: "loot:quarry-3",
			}),
		},
	}),
	item({
		id: "item:quarry-4",
		assetId: "asset:item-quarry",
		code: "quarry-4",
		name: "Quarry IV",
		tier: 4,
		maxStackSize: 1,
		description: "A sophisticated hole. Still a hole.",
		tags: [
			"producer",
			"building",
			"stone",
		],
		sort: 384,
		behavior: {
			merge: [
				imprint({
					id: "merge:quarry-4-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-quarry-4",
				}),
			],
			label: "4",
			producer: clickProducer({
				cooldownMs: 4100,
				outputTableId: "loot:quarry-4",
			}),
		},
	}),
	item({
		id: "item:quarry-5",
		assetId: "asset:item-quarry",
		code: "quarry-5",
		name: "Quarry V",
		tier: 5,
		maxStackSize: 1,
		description: "Rocks surrender before the tap lands.",
		tags: [
			"producer",
			"building",
			"stone",
		],
		sort: 388,
		behavior: {
			merge: [
				imprint({
					id: "merge:quarry-5-blueprint",
					withItemId: "item:blueprint",
					resultItemId: "item:blueprint-quarry-5",
				}),
			],
			label: "5",
			producer: clickProducer({
				cooldownMs: 3700,
				outputTableId: "loot:quarry-5",
			}),
		},
	}),
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
