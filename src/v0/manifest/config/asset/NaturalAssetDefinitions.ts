import type { AssetDefinition } from "../../asset";
import { asset } from "../../dsl/asset";

export const NaturalAssetDefinitions = [
	asset({
		id: "asset:item-seed",
		label: "Seed",
		fileName: "item-seed",
		sort: 10,
	}),
	asset({
		id: "asset:item-sprout",
		label: "Sprout",
		fileName: "item-sprout",
		sort: 20,
	}),
	asset({
		id: "asset:item-leaf",
		label: "Leaf",
		fileName: "item-leaf",
		sort: 30,
	}),
	asset({
		id: "asset:item-bush",
		label: "Bush",
		fileName: "item-bush",
		sort: 34,
	}),
	asset({
		id: "asset:item-sapling",
		label: "Sapling",
		fileName: "item-sapling",
		sort: 38,
	}),
	asset({
		id: "asset:item-tree",
		label: "Tree",
		fileName: "item-tree",
		sort: 39,
	}),
	asset({
		id: "asset:item-twig",
		label: "Twig",
		fileName: "item-twig",
		sort: 40,
	}),
	asset({
		id: "asset:item-branch",
		label: "Branch",
		fileName: "item-branch",
		sort: 50,
	}),
	asset({
		id: "asset:item-log",
		label: "Log",
		fileName: "item-log",
		sort: 60,
	}),
	asset({
		id: "asset:item-wood-bundle",
		label: "Wood Bundle",
		fileName: "item-wood-bundle",
		sort: 64,
	}),
	asset({
		id: "asset:item-plank",
		label: "Plank",
		fileName: "item-plank",
		sort: 66,
	}),
	asset({
		id: "asset:item-beam",
		label: "Beam",
		fileName: "item-beam",
		sort: 68,
	}),
	asset({
		id: "asset:item-pebble",
		label: "Pebble",
		fileName: "item-pebble",
		sort: 70,
	}),
	asset({
		id: "asset:item-stone",
		label: "Stone",
		fileName: "item-stone",
		sort: 80,
	}),
	asset({
		id: "asset:item-stone-block",
		label: "Stone Block",
		fileName: "item-stone-block",
		sort: 82,
	}),
	asset({
		id: "asset:item-ore",
		label: "Ore",
		fileName: "item-ore",
		sort: 84,
	}),
	asset({
		id: "asset:item-crystal",
		label: "Crystal",
		fileName: "item-crystal",
		sort: 90,
	}),
	asset({
		id: "asset:item-gem",
		label: "Gem",
		fileName: "item-gem",
		sort: 94,
	}),
	asset({
		id: "asset:item-water",
		label: "Water",
		fileName: "item-water",
		sort: 100,
	}),
	asset({
		id: "asset:item-coal",
		label: "Coal",
		fileName: "item-coal",
		sort: 132,
	}),
	asset({
		id: "asset:item-sausage",
		label: "Sausage",
		fileName: "item-sausage",
		sort: 134,
	}),
	asset({
		id: "asset:item-beer",
		label: "Beer",
		fileName: "item-beer",
		sort: 136,
	}),
] satisfies AssetDefinition[];
