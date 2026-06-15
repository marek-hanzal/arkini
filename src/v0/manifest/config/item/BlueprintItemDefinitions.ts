import type { ItemDefinition } from "../../item";
import { craft } from "../../dsl/craft";
import { input } from "../../dsl/input";
import { item } from "../../dsl/item";
import { same } from "../../dsl/same";

export const BlueprintItemDefinitions = [
	item({
		id: "item:blueprint-scrap",
		assetId: "asset:item-blueprint-scrap",
		code: "blueprint-scrap",
		name: "Blueprint Scrap",
		tier: 1,
		maxStackSize: 20,
		description: "A torn blank construction note. Inspiring, in the way paperwork can be.",
		tags: [
			"blueprint",
			"fragment",
		],
		sort: 200,
		behavior: {
			merge: [
				same({
					id: "merge:blueprint-scrap-fragment",
					selfItemId: "item:blueprint-scrap",
					resultItemId: "item:blueprint-fragment",
				}),
			],
		},
	}),
	item({
		id: "item:blueprint-fragment",
		assetId: "asset:item-blueprint-fragment",
		code: "blueprint-fragment",
		name: "Blueprint Fragment",
		tier: 2,
		maxStackSize: 15,
		description: "A bigger blank plan piece. Still technically a mess, but taller.",
		tags: [
			"blueprint",
			"fragment",
		],
		sort: 201,
		behavior: {
			merge: [
				same({
					id: "merge:blueprint-fragment-draft",
					selfItemId: "item:blueprint-fragment",
					resultItemId: "item:blueprint-draft",
				}),
			],
		},
	}),
	item({
		id: "item:blueprint-draft",
		assetId: "asset:item-blueprint-draft",
		code: "blueprint-draft",
		name: "Blueprint Draft",
		tier: 3,
		maxStackSize: 10,
		description: "A nearly usable blank plan. Construction bureaucracy is blooming.",
		tags: [
			"blueprint",
			"fragment",
		],
		sort: 202,
		behavior: {
			merge: [
				same({
					id: "merge:blueprint-draft-final",
					selfItemId: "item:blueprint-draft",
					resultItemId: "item:blueprint",
				}),
			],
		},
	}),
	item({
		id: "item:blueprint",
		assetId: "asset:item-blueprint",
		code: "blueprint",
		name: "Blank Blueprint",
		tier: 4,
		maxStackSize: 5,
		description:
			"A finished blank plan. Drag a known build target onto it to burn in the idea without sacrificing the original.",
		tags: [
			"blueprint",
			"blank",
		],
		sort: 203,
	}),
	item({
		id: "item:blueprint-lumber-camp",
		assetId: "asset:item-blueprint-lumber-camp",
		code: "blueprint-lumber-camp",
		name: "Lumber Camp Blueprint",
		tier: 4,
		maxStackSize: 5,
		description: "Finished plan. Now feed it materials until civilization happens.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 204,
		behavior: {
			craft: craft({
				id: "craft:lumber-camp",
				resultItemId: "item:lumber-camp-1",
				inputs: [
					input({
						itemId: "item:plank",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 1,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-quarry",
		assetId: "asset:item-blueprint-quarry",
		code: "blueprint-quarry",
		name: "Quarry Blueprint",
		tier: 4,
		maxStackSize: 5,
		description: "Finished plan. Now feed it materials until civilization happens.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 224,
		behavior: {
			craft: craft({
				id: "craft:quarry",
				resultItemId: "item:quarry-1",
				inputs: [
					input({
						itemId: "item:beam",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-townhall",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall",
		name: "Town Hall Blueprint",
		tier: 4,
		maxStackSize: 5,
		description: "Finished plan. Now feed it materials until civilization happens.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 244,
		behavior: {
			craft: craft({
				id: "craft:townhall",
				resultItemId: "item:townhall-1",
				inputs: [
					input({
						itemId: "item:beam",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
					input({
						itemId: "item:gem",
						quantity: 1,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-lumber-camp-2",
		assetId: "asset:item-blueprint-lumber-camp",
		code: "blueprint-lumber-camp-2",
		name: "Lumber Camp 2 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 206,
		behavior: {
			label: "2",
			craft: craft({
				id: "craft:lumber-camp-2",
				resultItemId: "item:lumber-camp-2",
				inputs: [
					input({
						itemId: "item:lumber-camp-1",
						quantity: 2,
					}),
					input({
						itemId: "item:plank",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 1,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-lumber-camp-3",
		assetId: "asset:item-blueprint-lumber-camp",
		code: "blueprint-lumber-camp-3",
		name: "Lumber Camp 3 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 207,
		behavior: {
			label: "3",
			craft: craft({
				id: "craft:lumber-camp-3",
				resultItemId: "item:lumber-camp-3",
				inputs: [
					input({
						itemId: "item:lumber-camp-2",
						quantity: 2,
					}),
					input({
						itemId: "item:plank",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 1,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-lumber-camp-4",
		assetId: "asset:item-blueprint-lumber-camp",
		code: "blueprint-lumber-camp-4",
		name: "Lumber Camp 4 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 208,
		behavior: {
			label: "4",
			craft: craft({
				id: "craft:lumber-camp-4",
				resultItemId: "item:lumber-camp-4",
				inputs: [
					input({
						itemId: "item:lumber-camp-3",
						quantity: 2,
					}),
					input({
						itemId: "item:plank",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 1,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-lumber-camp-5",
		assetId: "asset:item-blueprint-lumber-camp",
		code: "blueprint-lumber-camp-5",
		name: "Lumber Camp 5 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 209,
		behavior: {
			label: "5",
			craft: craft({
				id: "craft:lumber-camp-5",
				resultItemId: "item:lumber-camp-5",
				inputs: [
					input({
						itemId: "item:lumber-camp-4",
						quantity: 2,
					}),
					input({
						itemId: "item:plank",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 1,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-quarry-2",
		assetId: "asset:item-blueprint-quarry",
		code: "blueprint-quarry-2",
		name: "Quarry 2 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 226,
		behavior: {
			label: "2",
			craft: craft({
				id: "craft:quarry-2",
				resultItemId: "item:quarry-2",
				inputs: [
					input({
						itemId: "item:quarry-1",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-quarry-3",
		assetId: "asset:item-blueprint-quarry",
		code: "blueprint-quarry-3",
		name: "Quarry 3 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 227,
		behavior: {
			label: "3",
			craft: craft({
				id: "craft:quarry-3",
				resultItemId: "item:quarry-3",
				inputs: [
					input({
						itemId: "item:quarry-2",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-quarry-4",
		assetId: "asset:item-blueprint-quarry",
		code: "blueprint-quarry-4",
		name: "Quarry 4 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 228,
		behavior: {
			label: "4",
			craft: craft({
				id: "craft:quarry-4",
				resultItemId: "item:quarry-4",
				inputs: [
					input({
						itemId: "item:quarry-3",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-quarry-5",
		assetId: "asset:item-blueprint-quarry",
		code: "blueprint-quarry-5",
		name: "Quarry 5 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 229,
		behavior: {
			label: "5",
			craft: craft({
				id: "craft:quarry-5",
				resultItemId: "item:quarry-5",
				inputs: [
					input({
						itemId: "item:quarry-4",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 1,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-townhall-2",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall-2",
		name: "Town Hall 2 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 246,
		behavior: {
			label: "2",
			craft: craft({
				id: "craft:townhall-2",
				resultItemId: "item:townhall-2",
				inputs: [
					input({
						itemId: "item:townhall-1",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 2,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-townhall-3",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall-3",
		name: "Town Hall 3 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 247,
		behavior: {
			label: "3",
			craft: craft({
				id: "craft:townhall-3",
				resultItemId: "item:townhall-3",
				inputs: [
					input({
						itemId: "item:townhall-2",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 2,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-townhall-4",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall-4",
		name: "Town Hall 4 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 248,
		behavior: {
			label: "4",
			craft: craft({
				id: "craft:townhall-4",
				resultItemId: "item:townhall-4",
				inputs: [
					input({
						itemId: "item:townhall-3",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 2,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
				],
			}),
		},
	}),
	item({
		id: "item:blueprint-townhall-5",
		assetId: "asset:item-blueprint-townhall",
		code: "blueprint-townhall-5",
		name: "Town Hall 5 Blueprint",
		tier: 4,
		maxStackSize: 4,
		description:
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
		tags: [
			"blueprint",
			"craft-target",
		],
		sort: 249,
		behavior: {
			label: "5",
			craft: craft({
				id: "craft:townhall-5",
				resultItemId: "item:townhall-5",
				inputs: [
					input({
						itemId: "item:townhall-4",
						quantity: 2,
					}),
					input({
						itemId: "item:beam",
						quantity: 2,
					}),
					input({
						itemId: "item:stone-block",
						quantity: 2,
					}),
				],
			}),
		},
	}),
] satisfies ItemDefinition[];
