import type { AssetDefinition } from "./asset";
import type { CraftRecipeInput, ItemCraftRecipe } from "./craft";
import type { LootTableDefinition } from "./lootTable";
import type {
	AssetId,
	CraftRecipeId,
	ItemId,
	LootTableId,
	MergeDefinitionId,
	ResourceId,
	UpgradeId,
} from "./manifestId";
import type { ItemDefinition } from "./item";
import type { ItemMergeRule } from "./itemMergeRule";
import type {
	ProducerDefinition,
	ProducerMode,
	ProducerOutput,
	ProducerWeightedEntry,
	Quantity,
} from "./producer";
import type { ResourceDefinition } from "./resource";
import type { UpgradeDefinition, UpgradeEffectDefinition, UpgradeTierDefinition } from "./upgrade";

const svg = (name: string) => new URL(`./svg/${name}.svg`, import.meta.url).href;
const png = (name: string) => new URL(`./png/${name}.png`, import.meta.url).href;

// One config owns the gameplay shape. Items are not passive rows anymore:
// optional item behavior defines merges, producers, and build recipes in the
// same place as the visual identity. Data first, glue code second. Miracles.
export const GameConfig = {
	game: {
		id: "arkini",
		title: "Arkini",
		board: {
			width: 7,
			height: 9,
		},
		inventory: {
			slots: 35,
		},
		playerInventory: {
			slots: 12,
		},
	},
	assets: [
		asset("asset:item-seed", "Seed", "item-seed", 10, "png"),
		asset("asset:item-sprout", "Sprout", "item-sprout", 20, "png"),
		asset("asset:item-leaf", "Leaf", "item-leaf", 30, "png"),
		asset("asset:item-bush", "Bush", "item-bush", 34, "png"),
		asset("asset:item-sapling", "Sapling", "item-sapling", 38, "png"),
		asset("asset:item-tree", "Tree", "item-tree", 39, "png"),
		asset("asset:item-twig", "Twig", "item-twig", 40, "png"),
		asset("asset:item-branch", "Branch", "item-branch", 50, "png"),
		asset("asset:item-log", "Log", "item-log", 60, "png"),
		asset("asset:item-wood-bundle", "Wood Bundle", "item-wood-bundle", 64, "png"),
		asset("asset:item-plank", "Plank", "item-plank", 66, "png"),
		asset("asset:item-beam", "Beam", "item-beam", 68, "png"),
		asset("asset:item-pebble", "Pebble", "item-pebble", 70, "png"),
		asset("asset:item-stone", "Stone", "item-stone", 80, "png"),
		asset("asset:item-stone-block", "Stone Block", "item-stone-block", 82, "png"),
		asset("asset:item-ore", "Ore", "item-ore", 84, "png"),
		asset("asset:item-crystal", "Crystal", "item-crystal", 90, "png"),
		asset("asset:item-gem", "Gem", "item-gem", 94, "png"),
		asset("asset:item-water", "Water", "item-water", 100, "png"),
		asset("asset:item-coin", "Coin", "item-coin", 101, "png"),
		asset("asset:item-coin-pair", "Coin Pair", "item-coin-pair", 102, "png"),
		asset("asset:item-coin-stack", "Coin Stack", "item-coin-stack", 103, "png"),
		asset("asset:item-coin-chest", "Coin Chest", "item-coin-chest", 104, "png"),
		asset("asset:item-blueprint-scrap", "Blueprint Scrap", "item-blueprint-scrap", 106, "png"),
		asset(
			"asset:item-blueprint-fragment",
			"Blueprint Fragment",
			"item-blueprint-fragment",
			108,
			"png",
		),
		asset("asset:item-blueprint-draft", "Blueprint Draft", "item-blueprint-draft", 110, "png"),
		asset("asset:item-blueprint", "Finished Blueprint", "item-blueprint", 112, "png"),
		asset(
			"asset:item-blueprint-lumber-camp",
			"Lumber Camp Blueprint",
			"item-blueprint-lumber-camp-blueprint",
			116,
		),
		asset(
			"asset:item-blueprint-quarry",
			"Quarry Blueprint",
			"item-blueprint-quarry-blueprint",
			120,
		),
		asset(
			"asset:item-blueprint-townhall",
			"Town Hall Blueprint",
			"item-blueprint-townhall-blueprint",
			124,
		),
		asset("asset:item-townhall", "Town Hall", "item-townhall", 125, "png"),
		asset("asset:item-lumber-camp", "Lumber Camp", "item-lumber-camp", 130, "png"),
		asset("asset:item-coal", "Coal", "item-coal", 132, "png"),
		asset("asset:item-sausage", "Sausage", "item-sausage", 134, "png"),
		asset("asset:item-beer", "Beer", "item-beer", 136, "png"),
		asset("asset:item-coal-mine", "Coal Mine", "item-coal-mine", 138, "png"),
		asset("asset:item-quarry", "Quarry", "item-quarry", 140, "png"),
		asset("asset:item-crate", "Common Crate", "item-crate", 150, "png"),
		asset("asset:item-crate-sturdy", "Sturdy Crate", "item-crate-sturdy", 160, "png"),
		asset("asset:item-crate-rare", "Rare Crate", "item-crate-rare", 170, "png"),
		asset("asset:item-crate-epic", "Epic Crate", "item-crate-epic", 180, "png"),
	],
	resources: [] as readonly ResourceDefinition[],
	lootTables: [
		lootTable(
			"loot:lumber-camp-1:better-1",
			"Lumber Camp I Better Finds I",
			outputs(
				guaranteed("item:twig", 2),
				chance("item:branch", 0.55),
				chance("item:coin", 0.1),
			),
		),
		lootTable(
			"loot:lumber-camp-1:better-2",
			"Lumber Camp I Better Finds II",
			outputs(
				guaranteed("item:branch"),
				chance("item:twig", 0.85, {
					min: 1,
					max: 2,
				}),
				chance("item:log", 0.24),
				chance("item:coin-pair", 0.08),
			),
		),
		lootTable(
			"loot:quarry-1:better-1",
			"Quarry I Better Finds I",
			outputs(
				guaranteed("item:pebble", 2),
				chance("item:stone", 0.5),
				chance("item:coin", 0.1),
			),
		),
		lootTable(
			"loot:quarry-1:better-2",
			"Quarry I Better Finds II",
			outputs(
				guaranteed("item:stone"),
				chance("item:pebble", 0.85, {
					min: 1,
					max: 2,
				}),
				chance("item:ore", 0.18),
				chance("item:coin-pair", 0.08),
			),
		),
	],
	upgrades: [
		upgrade(
			"upgrade:lumber-camp-1-speed",
			"lumber-camp-1-speed",
			"Lumber Camp I Speed",
			"Shaves a little time off first-tier lumber production.",
			10,
			speedTiers("item:lumber-camp-1", [
				cost("item:coin-stack", 1),
				cost("item:coin-stack", 2),
				cost("item:coin-chest", 1),
				cost("item:coin-chest", 2),
				cost("item:coin-chest", 3),
			]),
		),
		upgrade(
			"upgrade:quarry-1-speed",
			"quarry-1-speed",
			"Quarry I Speed",
			"Makes the first quarry slightly less geological about deadlines.",
			20,
			speedTiers("item:quarry-1", [
				cost("item:coin-stack", 1),
				cost("item:coin-stack", 2),
				cost("item:coin-chest", 1),
				cost("item:coin-chest", 2),
				cost("item:coin-chest", 3),
			]),
		),
		upgrade(
			"upgrade:lumber-camp-1-loot",
			"lumber-camp-1-loot",
			"Lumber Camp I Better Finds",
			"Upgrades the first lumber camp loot table instead of poking random percentages with a stick.",
			30,
			[
				tier(
					[
						cost("item:coin-stack", 2),
					],
					[
						setLootTable("item:lumber-camp-1", "loot:lumber-camp-1:better-1"),
					],
				),
				tier(
					[
						cost("item:coin-chest", 2),
					],
					[
						setLootTable("item:lumber-camp-1", "loot:lumber-camp-1:better-2"),
					],
				),
			],
		),
		upgrade(
			"upgrade:quarry-1-loot",
			"quarry-1-loot",
			"Quarry I Better Finds",
			"Lets the first quarry find better rocks, because apparently holes need career growth.",
			40,
			[
				tier(
					[
						cost("item:coin-stack", 2),
					],
					[
						setLootTable("item:quarry-1", "loot:quarry-1:better-1"),
					],
				),
				tier(
					[
						cost("item:coin-chest", 2),
					],
					[
						setLootTable("item:quarry-1", "loot:quarry-1:better-2"),
					],
				),
			],
		),
		upgrade(
			"upgrade:player-inventory-capacity",
			"player-inventory-capacity",
			"Bigger Player Pouch",
			"Adds room for more collected valuables, because shiny clutter scales horizontally.",
			50,
			[
				tier(
					[
						cost("item:coin-chest", 1),
					],
					[
						capacity("player", 4),
					],
				),
				tier(
					[
						cost("item:coin-chest", 2),
					],
					[
						capacity("player", 4),
					],
				),
			],
		),
	],
	items: [
		item(
			"item:seed",
			"asset:item-seed",
			"seed",
			"Seed",
			1,
			50,
			"Tiny start of something suspiciously grindy.",
			[
				"material",
				"plant",
			],
			10,
			{
				merge: [
					same("merge:seed-seed-sprout", "item:seed", "item:sprout"),
				],
				craft: craft("craft:seed-water-sprout", "item:sprout", [
					input("item:water", 1),
				]),
			},
		),
		item(
			"item:sprout",
			"asset:item-sprout",
			"sprout",
			"Sprout",
			2,
			50,
			"A plant pretending it has a future.",
			[
				"material",
				"plant",
			],
			20,
			{
				merge: [
					same("merge:sprout-sprout-leaf", "item:sprout", "item:leaf"),
				],
				craft: craft("craft:sprout-water-sapling", "item:sapling", [
					input("item:water", 1),
				]),
			},
		),
		item(
			"item:leaf",
			"asset:item-leaf",
			"leaf",
			"Leaf",
			3,
			50,
			"Photosynthesis, but make it collectible.",
			[
				"material",
				"plant",
			],
			30,
			{
				merge: [
					same("merge:leaf-leaf-bush", "item:leaf", "item:bush"),
				],
			},
		),
		item(
			"item:bush",
			"asset:item-bush",
			"bush",
			"Bush",
			4,
			25,
			"A leaf committee with roots.",
			[
				"material",
				"plant",
			],
			34,
			{
				merge: [
					same("merge:bush-bush-sapling", "item:bush", "item:sapling"),
				],
			},
		),
		item(
			"item:sapling",
			"asset:item-sapling",
			"sapling",
			"Sapling",
			5,
			15,
			"Future tree, current storage problem.",
			[
				"material",
				"plant",
			],
			38,
			{
				craft: craft("craft:sapling-water-tree", "item:tree", [
					input("item:water", 2),
				]),
			},
		),
		item(
			"item:tree",
			"asset:item-tree",
			"tree",
			"Tree",
			6,
			1,
			"A tiny forest economy waiting to happen.",
			[
				"producer",
				"plant",
				"wood",
			],
			39,
			{
				producer: clickProducer(
					6200,
					outputs(
						guaranteed("item:twig", 2),
						chance("item:branch", 0.35),
						chance("item:coin", 0.08),
					),
				),
			},
		),
		item(
			"item:twig",
			"asset:item-twig",
			"twig",
			"Twig",
			1,
			50,
			"Nature's disposable stick.",
			[
				"material",
				"wood",
			],
			40,
			{
				merge: [
					same("merge:twig-twig-branch", "item:twig", "item:branch"),
					combo("merge:twig-water-sprout", "item:water", "item:sprout", true),
				],
			},
		),
		item(
			"item:branch",
			"asset:item-branch",
			"branch",
			"Branch",
			2,
			50,
			"Bigger stick. Humanity is saved.",
			[
				"material",
				"wood",
			],
			50,
			{
				merge: [
					same("merge:branch-branch-log", "item:branch", "item:log"),
				],
			},
		),
		item(
			"item:log",
			"asset:item-log",
			"log",
			"Log",
			3,
			50,
			"A tree with fewer opinions.",
			[
				"material",
				"wood",
			],
			60,
			{
				merge: [
					same("merge:log-log-wood-bundle", "item:log", "item:wood-bundle"),
				],
			},
		),
		item(
			"item:wood-bundle",
			"asset:item-wood-bundle",
			"wood-bundle",
			"Wood Bundle",
			4,
			25,
			"Several logs tied together, because one headache was not enough.",
			[
				"material",
				"wood",
			],
			64,
			{
				merge: [
					same("merge:wood-bundle-wood-bundle-plank", "item:wood-bundle", "item:plank"),
				],
			},
		),
		item(
			"item:plank",
			"asset:item-plank",
			"plank",
			"Plank",
			5,
			20,
			"Wood with straight edges. Humanity briefly improves.",
			[
				"material",
				"wood",
			],
			66,
			{
				merge: [
					same("merge:plank-plank-beam", "item:plank", "item:beam"),
				],
			},
		),

		item(
			"item:beam",
			"asset:item-beam",
			"beam",
			"Beam",
			5,
			15,
			"Wood that finally looks employable.",
			[
				"material",
				"wood",
			],
			68,
		),
		item(
			"item:pebble",
			"asset:item-pebble",
			"pebble",
			"Pebble",
			1,
			50,
			"Small rock. Big destiny. Apparently.",
			[
				"material",
				"stone",
			],
			70,
			{
				merge: [
					same("merge:pebble-pebble-stone", "item:pebble", "item:stone"),
				],
			},
		),
		item(
			"item:stone",
			"asset:item-stone",
			"stone",
			"Stone",
			2,
			50,
			"Rock with self-esteem.",
			[
				"material",
				"stone",
			],
			80,
			{
				merge: [
					same("merge:stone-stone-stone-block", "item:stone", "item:stone-block"),
					combo("merge:stone-water-crystal", "item:water", "item:crystal", true),
				],
			},
		),
		item(
			"item:stone-block",
			"asset:item-stone-block",
			"stone-block",
			"Stone Block",
			3,
			30,
			"Stone that finally agreed to geometry.",
			[
				"material",
				"stone",
			],
			82,
			{
				merge: [
					same("merge:stone-block-stone-block-ore", "item:stone-block", "item:ore"),
				],
			},
		),

		item(
			"item:ore",
			"asset:item-ore",
			"ore",
			"Ore",
			3,
			40,
			"Stone with ambition and questionable impurities.",
			[
				"material",
				"stone",
			],
			84,
			{
				merge: [
					same("merge:ore-ore-crystal", "item:ore", "item:crystal"),
				],
			},
		),
		item(
			"item:crystal",
			"asset:item-crystal",
			"crystal",
			"Crystal",
			4,
			25,
			"Shiny enough to justify bad decisions.",
			[
				"material",
				"stone",
				"rare",
			],
			90,
			{
				merge: [
					same("merge:crystal-crystal-gem", "item:crystal", "item:gem"),
				],
			},
		),
		item(
			"item:gem",
			"asset:item-gem",
			"gem",
			"Gem",
			5,
			15,
			"A crystal with marketing budget.",
			[
				"material",
				"stone",
				"rare",
			],
			94,
		),
		item(
			"item:water",
			"asset:item-water",
			"water",
			"Water",
			1,
			50,
			"Liquid logistics. Somehow still your problem.",
			[
				"material",
				"water",
			],
			100,
		),

		item(
			"item:coal",
			"asset:item-coal",
			"coal",
			"Coal",
			2,
			40,
			"Black fuel for machines that apparently need motivation.",
			[
				"material",
				"fuel",
			],
			105,
		),
		item(
			"item:sausage",
			"asset:item-sausage",
			"sausage",
			"Sausage",
			1,
			30,
			"Producer fuel, because workers are tragically organic.",
			[
				"material",
				"food",
			],
			106,
		),
		item(
			"item:beer",
			"asset:item-beer",
			"beer",
			"Beer",
			1,
			30,
			"Liquid morale. The economy is clearly fine.",
			[
				"material",
				"drink",
			],
			107,
		),

		item(
			"item:coin",
			"asset:item-coin",
			"coin",
			"Coin",
			1,
			50,
			"A small metal excuse for progression.",
			[
				"collectible",
				"currency",
			],
			180,
			{
				merge: [
					same("merge:coin-coin-pair", "item:coin", "item:coin-pair"),
				],
				collect: collectible(),
			},
		),
		item(
			"item:coin-pair",
			"asset:item-coin-pair",
			"coin-pair",
			"Coin Pair",
			2,
			40,
			"Two coins. Somehow this already feels like accounting.",
			[
				"collectible",
				"currency",
			],
			182,
			{
				merge: [
					same("merge:coin-pair-stack", "item:coin-pair", "item:coin-stack"),
				],
				collect: collectible(),
			},
		),
		item(
			"item:coin-stack",
			"asset:item-coin-stack",
			"coin-stack",
			"Coin Stack",
			3,
			30,
			"A stack of little reasons to open the upgrades sheet.",
			[
				"collectible",
				"currency",
			],
			184,
			{
				merge: [
					same("merge:coin-stack-chest", "item:coin-stack", "item:coin-chest"),
				],
				collect: collectible(),
			},
		),
		item(
			"item:coin-chest",
			"asset:item-coin-chest",
			"coin-chest",
			"Coin Chest",
			4,
			20,
			"A boxed-up upgrade fund. Finally, clutter with ambition.",
			[
				"collectible",
				"currency",
			],
			186,
			{
				collect: collectible(),
			},
		),

		item(
			"item:blueprint-scrap",
			"asset:item-blueprint-scrap",
			"blueprint-scrap",
			"Blueprint Scrap",
			1,
			20,
			"A torn blank construction note. Inspiring, in the way paperwork can be.",
			[
				"blueprint",
				"fragment",
			],
			200,
			{
				merge: [
					same(
						"merge:blueprint-scrap-fragment",
						"item:blueprint-scrap",
						"item:blueprint-fragment",
					),
				],
			},
		),
		item(
			"item:blueprint-fragment",
			"asset:item-blueprint-fragment",
			"blueprint-fragment",
			"Blueprint Fragment",
			2,
			15,
			"A bigger blank plan piece. Still technically a mess, but taller.",
			[
				"blueprint",
				"fragment",
			],
			201,
			{
				merge: [
					same(
						"merge:blueprint-fragment-draft",
						"item:blueprint-fragment",
						"item:blueprint-draft",
					),
				],
			},
		),
		item(
			"item:blueprint-draft",
			"asset:item-blueprint-draft",
			"blueprint-draft",
			"Blueprint Draft",
			3,
			10,
			"A nearly usable blank plan. Construction bureaucracy is blooming.",
			[
				"blueprint",
				"fragment",
			],
			202,
			{
				merge: [
					same(
						"merge:blueprint-draft-final",
						"item:blueprint-draft",
						"item:blueprint",
					),
				],
			},
		),
		item(
			"item:blueprint",
			"asset:item-blueprint",
			"blueprint",
			"Blank Blueprint",
			4,
			5,
			"A finished blank plan. Drag a known build target onto it to burn in the idea without sacrificing the original.",
			[
				"blueprint",
				"blank",
			],
			203,
		),

		item(
			"item:blueprint-lumber-camp",
			"asset:item-blueprint-lumber-camp",
			"blueprint-lumber-camp",
			"Lumber Camp Blueprint",
			4,
			5,
			"Finished plan. Now feed it materials until civilization happens.",
			[
				"blueprint",
				"craft-target",
			],
			204,
			{
				craft: craft("craft:lumber-camp", "item:lumber-camp-1", [
					input("item:plank", 1),
					input("item:stone-block", 1),
				]),
			},
		),

		item(
			"item:blueprint-quarry",
			"asset:item-blueprint-quarry",
			"blueprint-quarry",
			"Quarry Blueprint",
			4,
			5,
			"Finished plan. Now feed it materials until civilization happens.",
			[
				"blueprint",
				"craft-target",
			],
			224,
			{
				craft: craft("craft:quarry", "item:quarry-1", [
					input("item:beam", 1),
					input("item:stone-block", 2),
				]),
			},
		),

		item(
			"item:blueprint-townhall",
			"asset:item-blueprint-townhall",
			"blueprint-townhall",
			"Town Hall Blueprint",
			4,
			5,
			"Finished plan. Now feed it materials until civilization happens.",
			[
				"blueprint",
				"craft-target",
			],
			244,
			{
				craft: craft("craft:townhall", "item:townhall-1", [
					input("item:beam", 1),
					input("item:stone-block", 2),
					input("item:gem", 1),
				]),
			},
		),

		item(
			"item:blueprint-lumber-camp-2",
			"asset:item-blueprint-lumber-camp",
			"blueprint-lumber-camp-2",
			"Lumber Camp 2 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			206,
			{
				label: "2",
				craft: craft("craft:lumber-camp-2", "item:lumber-camp-2", [
					input("item:lumber-camp-1", 2),
					input("item:plank", 1),
					input("item:stone-block", 1),
				]),
			},
		),

		item(
			"item:blueprint-lumber-camp-3",
			"asset:item-blueprint-lumber-camp",
			"blueprint-lumber-camp-3",
			"Lumber Camp 3 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			207,
			{
				label: "3",
				craft: craft("craft:lumber-camp-3", "item:lumber-camp-3", [
					input("item:lumber-camp-2", 2),
					input("item:plank", 1),
					input("item:stone-block", 1),
				]),
			},
		),

		item(
			"item:blueprint-lumber-camp-4",
			"asset:item-blueprint-lumber-camp",
			"blueprint-lumber-camp-4",
			"Lumber Camp 4 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			208,
			{
				label: "4",
				craft: craft("craft:lumber-camp-4", "item:lumber-camp-4", [
					input("item:lumber-camp-3", 2),
					input("item:plank", 1),
					input("item:stone-block", 1),
				]),
			},
		),

		item(
			"item:blueprint-lumber-camp-5",
			"asset:item-blueprint-lumber-camp",
			"blueprint-lumber-camp-5",
			"Lumber Camp 5 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			209,
			{
				label: "5",
				craft: craft("craft:lumber-camp-5", "item:lumber-camp-5", [
					input("item:lumber-camp-4", 2),
					input("item:plank", 1),
					input("item:stone-block", 1),
				]),
			},
		),

		item(
			"item:blueprint-quarry-2",
			"asset:item-blueprint-quarry",
			"blueprint-quarry-2",
			"Quarry 2 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			226,
			{
				label: "2",
				craft: craft("craft:quarry-2", "item:quarry-2", [
					input("item:quarry-1", 2),
					input("item:beam", 1),
					input("item:stone-block", 2),
				]),
			},
		),

		item(
			"item:blueprint-quarry-3",
			"asset:item-blueprint-quarry",
			"blueprint-quarry-3",
			"Quarry 3 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			227,
			{
				label: "3",
				craft: craft("craft:quarry-3", "item:quarry-3", [
					input("item:quarry-2", 2),
					input("item:beam", 1),
					input("item:stone-block", 2),
				]),
			},
		),

		item(
			"item:blueprint-quarry-4",
			"asset:item-blueprint-quarry",
			"blueprint-quarry-4",
			"Quarry 4 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			228,
			{
				label: "4",
				craft: craft("craft:quarry-4", "item:quarry-4", [
					input("item:quarry-3", 2),
					input("item:beam", 1),
					input("item:stone-block", 2),
				]),
			},
		),

		item(
			"item:blueprint-quarry-5",
			"asset:item-blueprint-quarry",
			"blueprint-quarry-5",
			"Quarry 5 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			229,
			{
				label: "5",
				craft: craft("craft:quarry-5", "item:quarry-5", [
					input("item:quarry-4", 2),
					input("item:beam", 1),
					input("item:stone-block", 2),
				]),
			},
		),

		item(
			"item:blueprint-townhall-2",
			"asset:item-blueprint-townhall",
			"blueprint-townhall-2",
			"Town Hall 2 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			246,
			{
				label: "2",
				craft: craft("craft:townhall-2", "item:townhall-2", [
					input("item:townhall-1", 2),
					input("item:beam", 2),
					input("item:stone-block", 2),
				]),
			},
		),

		item(
			"item:blueprint-townhall-3",
			"asset:item-blueprint-townhall",
			"blueprint-townhall-3",
			"Town Hall 3 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			247,
			{
				label: "3",
				craft: craft("craft:townhall-3", "item:townhall-3", [
					input("item:townhall-2", 2),
					input("item:beam", 2),
					input("item:stone-block", 2),
				]),
			},
		),

		item(
			"item:blueprint-townhall-4",
			"asset:item-blueprint-townhall",
			"blueprint-townhall-4",
			"Town Hall 4 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			248,
			{
				label: "4",
				craft: craft("craft:townhall-4", "item:townhall-4", [
					input("item:townhall-3", 2),
					input("item:beam", 2),
					input("item:stone-block", 2),
				]),
			},
		),

		item(
			"item:blueprint-townhall-5",
			"asset:item-blueprint-townhall",
			"blueprint-townhall-5",
			"Town Hall 5 Blueprint",
			4,
			4,
			"Upgrade plan that wants real materials and two previous buildings. Easy wins are banned, mercifully.",
			[
				"blueprint",
				"craft-target",
			],
			249,
			{
				label: "5",
				craft: craft("craft:townhall-5", "item:townhall-5", [
					input("item:townhall-4", 2),
					input("item:beam", 2),
					input("item:stone-block", 2),
				]),
			},
		),
		item(
			"item:townhall-1",
			"asset:item-townhall",
			"townhall-1",
			"Town Hall I",
			1,
			1,
			"A tiny bureaucracy that spits out progress.",
			[
				"producer",
				"building",
				"townhall",
			],
			300,
			{
				merge: [
					imprint("merge:townhall-1-blueprint", "item:blueprint", "item:blueprint-townhall"),
				],
				label: "1",
				producer: clickProducer(
					3500,
					outputs(
						weighted([
							drop("item:blueprint-scrap", 90),
							drop("item:crate-1", 10),
						]),
						chance("item:water", 0.32),
					),
				),
			},
		),
		item(
			"item:townhall-2",
			"asset:item-townhall",
			"townhall-2",
			"Town Hall II",
			2,
			1,
			"Same bureaucracy, slightly shinier clipboard.",
			[
				"producer",
				"building",
				"townhall",
			],
			310,
			{
				merge: [
					imprint("merge:townhall-2-blueprint", "item:blueprint", "item:blueprint-townhall-2"),
				],
				label: "2",
				producer: clickProducer(
					3000,
					outputs(
						weighted([
							drop("item:blueprint-scrap", 60),
							drop("item:crate-1", 28),
							drop("item:crate-2", 12),
							drop("item:blueprint-lumber-camp-2", 6),
							drop("item:blueprint-quarry-2", 6),
						]),
						chance("item:water", 0.4, {
							min: 1,
							max: 2,
						}),
					),
				),
			},
		),
		item(
			"item:townhall-3",
			"asset:item-townhall",
			"townhall-3",
			"Town Hall III",
			3,
			1,
			"Municipal paperwork with actual momentum.",
			[
				"producer",
				"building",
				"townhall",
			],
			320,
			{
				merge: [
					imprint("merge:townhall-3-blueprint", "item:blueprint", "item:blueprint-townhall-3"),
				],
				label: "3",
				producer: clickProducer(
					2500,
					outputs(
						weighted([
							drop("item:blueprint-scrap", 40),
							drop("item:crate-1", 18),
							drop("item:crate-2", 30),
							drop("item:crate-3", 12),
							drop("item:blueprint-lumber-camp-3", 5),
							drop("item:blueprint-quarry-3", 5),
						]),
						chance("item:water", 0.55, {
							min: 1,
							max: 2,
						}),
					),
				),
			},
		),

		item(
			"item:townhall-4",
			"asset:item-townhall",
			"townhall-4",
			"Town Hall IV",
			4,
			1,
			"Bureaucracy with sparkles. Humanity had options.",
			[
				"producer",
				"building",
				"townhall",
			],
			324,
			{
				merge: [
					imprint("merge:townhall-4-blueprint", "item:blueprint", "item:blueprint-townhall-4"),
				],
				label: "4",
				producer: clickProducer(
					2200,
					outputs(
						weighted([
							drop("item:blueprint-scrap", 36),
							drop("item:crate-2", 34),
							drop("item:crate-3", 22),
							drop("item:crate-4", 8),
							drop("item:blueprint-lumber-camp-4", 4),
							drop("item:blueprint-quarry-4", 4),
						]),
						chance("item:water", 0.62, {
							min: 1,
							max: 2,
						}),
					),
				),
			},
		),
		item(
			"item:townhall-5",
			"asset:item-townhall",
			"townhall-5",
			"Town Hall V",
			5,
			1,
			"A municipal beast with alarming confidence.",
			[
				"producer",
				"building",
				"townhall",
			],
			328,
			{
				merge: [
					imprint("merge:townhall-5-blueprint", "item:blueprint", "item:blueprint-townhall-5"),
				],
				label: "5",
				producer: clickProducer(
					1900,
					outputs(
						weighted([
							drop("item:blueprint-scrap", 30),
							drop("item:crate-2", 28),
							drop("item:crate-3", 30),
							drop("item:crate-4", 12),
							drop("item:blueprint-lumber-camp-5", 3),
							drop("item:blueprint-quarry-5", 3),
						]),
						chance("item:water", 0.72, {
							min: 1,
							max: 3,
						}),
					),
				),
			},
		),

		item(
			"item:lumber-camp-1",
			"asset:item-lumber-camp",
			"lumber-camp-1",
			"Lumber Camp I",
			1,
			1,
			"A polite machine for turning time into sticks.",
			[
				"producer",
				"building",
				"wood",
			],
			330,
			{
				merge: [
					imprint("merge:lumber-camp-1-blueprint", "item:blueprint", "item:blueprint-lumber-camp"),
				],
				label: "1",
				producer: clickProducer(
					5000,
					outputs(
						guaranteed("item:twig", 2),
						chance("item:branch", 0.35),
						chance("item:coin", 0.08),
					),
				),
			},
		),
		item(
			"item:lumber-camp-2",
			"asset:item-lumber-camp",
			"lumber-camp-2",
			"Lumber Camp II",
			2,
			1,
			"Still wood, but now with ambition.",
			[
				"producer",
				"building",
				"wood",
			],
			340,
			{
				merge: [
					imprint("merge:lumber-camp-2-blueprint", "item:blueprint", "item:blueprint-lumber-camp-2"),
				],
				label: "2",
				producer: clickProducer(
					4500,
					outputs(
						guaranteed("item:branch"),
						chance("item:twig", 0.5, {
							min: 1,
							max: 2,
						}),
						chance("item:log", 0.35),
					),
				),
			},
		),
		item(
			"item:lumber-camp-3",
			"asset:item-lumber-camp",
			"lumber-camp-3",
			"Lumber Camp III",
			3,
			1,
			"A compact shrine to deforestation.",
			[
				"producer",
				"building",
				"wood",
			],
			350,
			{
				merge: [
					imprint("merge:lumber-camp-3-blueprint", "item:blueprint", "item:blueprint-lumber-camp-3"),
				],
				label: "3",
				producer: clickProducer(
					4000,
					outputs(guaranteed("item:branch", 2), chance("item:log", 0.7)),
				),
			},
		),

		item(
			"item:lumber-camp-4",
			"asset:item-lumber-camp",
			"lumber-camp-4",
			"Lumber Camp IV",
			4,
			1,
			"Deforestation, now with workflows.",
			[
				"producer",
				"building",
				"wood",
			],
			354,
			{
				merge: [
					imprint("merge:lumber-camp-4-blueprint", "item:blueprint", "item:blueprint-lumber-camp-4"),
				],
				label: "4",
				producer: clickProducer(
					3600,
					outputs(
						guaranteed("item:log", 1),
						chance("item:branch", 0.75, {
							min: 1,
							max: 2,
						}),
						chance("item:wood-bundle", 0.3),
					),
				),
			},
		),
		item(
			"item:lumber-camp-5",
			"asset:item-lumber-camp",
			"lumber-camp-5",
			"Lumber Camp V",
			5,
			1,
			"At this point the forest has filed a complaint.",
			[
				"producer",
				"building",
				"wood",
			],
			358,
			{
				merge: [
					imprint("merge:lumber-camp-5-blueprint", "item:blueprint", "item:blueprint-lumber-camp-5"),
				],
				label: "5",
				producer: clickProducer(
					3200,
					outputs(
						guaranteed("item:log", 2),
						chance("item:wood-bundle", 0.55),
						chance("item:beam", 0.18),
					),
				),
			},
		),

		item(
			"item:quarry-1",
			"asset:item-quarry",
			"quarry-1",
			"Quarry I",
			1,
			1,
			"A hole in the ground with a business model.",
			[
				"producer",
				"building",
				"stone",
			],
			360,
			{
				merge: [
					imprint("merge:quarry-1-blueprint", "item:blueprint", "item:blueprint-quarry"),
				],
				label: "1",
				producer: clickProducer(
					5500,
					outputs(
						guaranteed("item:pebble", 2),
						chance("item:stone", 0.32),
						chance("item:coin", 0.08),
					),
				),
			},
		),
		item(
			"item:quarry-2",
			"asset:item-quarry",
			"quarry-2",
			"Quarry II",
			2,
			1,
			"A deeper hole, because progress is weird.",
			[
				"producer",
				"building",
				"stone",
			],
			370,
			{
				merge: [
					imprint("merge:quarry-2-blueprint", "item:blueprint", "item:blueprint-quarry-2"),
				],
				label: "2",
				producer: clickProducer(
					5000,
					outputs(
						guaranteed("item:stone"),
						chance("item:pebble", 0.5, {
							min: 1,
							max: 2,
						}),
						chance("item:crystal", 0.28),
					),
				),
			},
		),
		item(
			"item:quarry-3",
			"asset:item-quarry",
			"quarry-3",
			"Quarry III",
			3,
			1,
			"Rocks leaving the earth at startup velocity.",
			[
				"producer",
				"building",
				"stone",
			],
			380,
			{
				merge: [
					imprint("merge:quarry-3-blueprint", "item:blueprint", "item:blueprint-quarry-3"),
				],
				label: "3",
				producer: clickProducer(
					4500,
					outputs(guaranteed("item:stone", 2), chance("item:crystal", 0.72)),
				),
			},
		),

		item(
			"item:quarry-4",
			"asset:item-quarry",
			"quarry-4",
			"Quarry IV",
			4,
			1,
			"A sophisticated hole. Still a hole.",
			[
				"producer",
				"building",
				"stone",
			],
			384,
			{
				merge: [
					imprint("merge:quarry-4-blueprint", "item:blueprint", "item:blueprint-quarry-4"),
				],
				label: "4",
				producer: clickProducer(
					4100,
					outputs(
						guaranteed("item:stone", 2),
						chance("item:ore", 0.48),
						chance("item:crystal", 0.28),
					),
				),
			},
		),
		item(
			"item:quarry-5",
			"asset:item-quarry",
			"quarry-5",
			"Quarry V",
			5,
			1,
			"Rocks surrender before the tap lands.",
			[
				"producer",
				"building",
				"stone",
			],
			388,
			{
				merge: [
					imprint("merge:quarry-5-blueprint", "item:blueprint", "item:blueprint-quarry-5"),
				],
				label: "5",
				producer: clickProducer(
					3700,
					outputs(
						guaranteed("item:stone", 2),
						chance("item:ore", 0.7),
						chance("item:crystal", 0.42),
						chance("item:gem", 0.12),
					),
				),
			},
		),

		item(
			"item:coal-mine-1",
			"asset:item-coal-mine",
			"coal-mine-1",
			"Coal Mine I",
			1,
			1,
			"Produces coal only after it receives sausage and beer. Labor relations remain advanced nonsense.",
			[
				"producer",
				"building",
				"fuel",
			],
			392,
			{
				label: "1",
				producer: clickProducer(
					5200,
					outputs(guaranteed("item:coal"), chance("item:coin", 0.12)),
					{
						type: "infinite",
					},
					[
						producerInput("item:sausage", 1, 4),
						producerInput("item:beer", 1, 4),
					],
				),
			},
		),

		item(
			"item:crate-1",
			"asset:item-crate",
			"crate-1",
			"Common Crate",
			1,
			1,
			"A finite producer with suspicious contents.",
			[
				"producer",
				"container",
			],
			400,
			{
				merge: [
					same("merge:crate-1-crate-2", "item:crate-1", "item:crate-2"),
				],
				producer: {
					...clickProducer(
						900,
						outputs(
							weighted([
								drop("item:twig", 35),
								drop("item:pebble", 35),
								drop("item:water", 15),
								drop("item:seed", 12),
								drop("item:coin", 8),
							]),
							chance("item:twig", 0.18),
						),
						{
							type: "finite",
							charges: 3,
							onDepleted: "remove",
						},
					),
					doubleClickBehavior: "exhaust",
				},
			},
		),
		item(
			"item:crate-2",
			"asset:item-crate-sturdy",
			"crate-2",
			"Sturdy Crate",
			2,
			1,
			"Same box, fewer disappointments.",
			[
				"producer",
				"container",
			],
			410,
			{
				merge: [
					same("merge:crate-2-crate-3", "item:crate-2", "item:crate-3"),
				],
				producer: {
					...clickProducer(
						900,
						outputs(
							weighted([
								drop("item:branch", 35),
								drop("item:stone", 35),
								drop("item:water", 15),
								drop("item:crate-1", 12),
								drop("item:coin-pair", 8),
							]),
							chance("item:pebble", 0.22),
						),
						{
							type: "finite",
							charges: 4,
							onDepleted: "remove",
						},
					),
					doubleClickBehavior: "exhaust",
				},
			},
		),
		item(
			"item:crate-3",
			"asset:item-crate-rare",
			"crate-3",
			"Rare Crate",
			3,
			1,
			"A tiny treasure economy in a box.",
			[
				"producer",
				"container",
				"rare",
			],
			420,
			{
				merge: [
					same("merge:crate-3-crate-4", "item:crate-3", "item:crate-4"),
				],
				producer: {
					...clickProducer(
						900,
						outputs(
							weighted([
								drop("item:log", 30),
								drop("item:crystal", 30),
								drop("item:crate-2", 20),
								drop("item:water", 16),
								drop("item:coin-stack", 8),
							]),
							chance("item:branch", 0.24),
						),
						{
							type: "finite",
							charges: 5,
							onDepleted: "remove",
						},
					),
					doubleClickBehavior: "exhaust",
				},
			},
		),

		item(
			"item:crate-4",
			"asset:item-crate-epic",
			"crate-4",
			"Epic Crate",
			4,
			1,
			"Purple box. The economy is doomed.",
			[
				"producer",
				"container",
				"rare",
			],
			430,
			{
				producer: {
					...clickProducer(
						900,
						outputs(
							weighted([
								drop("item:wood-bundle", 25),
								drop("item:beam", 15),
								drop("item:crystal", 25),
								drop("item:gem", 15),
								drop("item:water", 16),
								drop("item:coin-stack", 8),
							]),
							chance("item:crate-3", 0.2),
						),
						{
							type: "finite",
							charges: 6,
							onDepleted: "remove",
						},
					),
					doubleClickBehavior: "exhaust",
				},
			},
		),
	],
	startingState: {
		playerInventory: [
			{
				itemId: "item:coin-stack",
				quantity: 1,
			},
		],
		resources: [] as readonly {
			resourceId: ResourceId;
			quantity: number;
		}[],
		inventory: [
			{
				itemId: "item:blueprint-scrap",
				quantity: 10,
			},
			{
				itemId: "item:twig",
				quantity: 8,
			},
			{
				itemId: "item:pebble",
				quantity: 8,
			},
			{
				itemId: "item:water",
				quantity: 4,
			},
			{
				itemId: "item:sausage",
				quantity: 3,
			},
			{
				itemId: "item:beer",
				quantity: 3,
			},
		],
		board: [
			{
				itemId: "item:townhall-1",
				x: 3,
				y: 4,
			},
			{
				itemId: "item:lumber-camp-1",
				x: 1,
				y: 4,
			},
			{
				itemId: "item:quarry-1",
				x: 5,
				y: 4,
			},
			{
				itemId: "item:coal-mine-1",
				x: 3,
				y: 6,
			},
		],
	},
} satisfies GameConfig.Shape;

export type GameConfig = typeof GameConfig;

export namespace GameConfig {
	export interface Shape {
		game: {
			id: "arkini";
			title: "Arkini";
			board: {
				width: 7;
				height: 9;
			};
			inventory: {
				slots: number;
			};
			playerInventory: {
				slots: number;
			};
		};
		assets: readonly AssetDefinition[];
		resources: readonly ResourceDefinition[];
		lootTables: readonly LootTableDefinition[];
		upgrades: readonly UpgradeDefinition[];
		items: readonly ItemDefinition[];
		startingState: {
			playerInventory: readonly {
				itemId: ItemId;
				quantity: number;
			}[];
			resources: readonly {
				resourceId: ResourceId;
				quantity: number;
			}[];
			inventory: readonly {
				itemId: ItemId;
				quantity: number;
			}[];
			board: readonly {
				itemId: ItemId;
				x: number;
				y: number;
			}[];
		};
	}
}

function resource(
	id: ResourceId,
	code: string,
	name: string,
	description: string,
	symbol: string,
	sort: number,
): ResourceDefinition {
	return {
		id,
		code,
		name,
		description,
		symbol,
		sort,
	};
}

function asset(
	id: AssetId,
	label: string,
	fileName: string,
	sort: number,
	format: "svg" | "png" = "svg",
): AssetDefinition {
	return {
		id,
		kind: "item",
		label,
		src: format === "png" ? png(fileName) : svg(fileName),
		sort,
	};
}

function item(
	id: ItemId,
	assetId: AssetId,
	code: string,
	name: string,
	tier: number,
	maxStackSize: number,
	description: string,
	tags: readonly string[],
	sort: number,
	behavior: Pick<ItemDefinition, "label" | "merge" | "producer" | "craft" | "collect"> = {},
): ItemDefinition {
	return {
		id,
		assetId,
		code,
		name,
		tier,
		maxStackSize,
		description,
		tags,
		sort,
		...behavior,
	};
}

function same(id: MergeDefinitionId, selfItemId: ItemId, resultItemId: ItemId): ItemMergeRule {
	return {
		id,
		withItemId: selfItemId,
		resultItemId,
	};
}

function combo(
	id: MergeDefinitionId,
	withItemId: ItemId,
	resultItemId: ItemId,
	secret = false,
): ItemMergeRule {
	return {
		id,
		withItemId,
		resultItemId,
		secret,
	};
}

function imprint(
	id: MergeDefinitionId,
	withItemId: ItemId,
	resultItemId: ItemId,
): ItemMergeRule {
	return {
		id,
		withItemId,
		resultItemId,
		consumeSource: false,
		secret: true,
	};
}

function craft(
	id: CraftRecipeId,
	resultItemId: ItemId,
	inputs: readonly CraftRecipeInput[],
): ItemCraftRecipe {
	return {
		id,
		resultItemId,
		inputs,
	};
}

function input(itemId: ItemId, quantity: number): CraftRecipeInput {
	return {
		itemId,
		quantity,
	};
}

function collectible(itemId?: ItemId, quantity = 1): NonNullable<ItemDefinition["collect"]> {
	return {
		inventory: "player",
		itemId,
		quantity,
	};
}

function lootTable(
	id: LootTableId,
	name: string,
	output: readonly ProducerOutput[],
): LootTableDefinition {
	return {
		id,
		name,
		output,
	};
}

function upgrade(
	id: UpgradeId,
	code: string,
	name: string,
	description: string,
	sort: number,
	tiers: readonly UpgradeTierDefinition[],
): UpgradeDefinition {
	return {
		id,
		code,
		name,
		description,
		sort,
		tiers,
	};
}

function tier(
	cost: readonly UpgradeTierDefinition["cost"][number][],
	effects: readonly UpgradeEffectDefinition[],
	durationMs = 6000,
): UpgradeTierDefinition {
	return {
		cost,
		effects,
		durationMs,
	};
}

function cost(itemId: ItemId, quantity: number): UpgradeTierDefinition["cost"][number] {
	return {
		itemId,
		quantity,
	};
}

function speedTiers(
	itemId: ItemId,
	costs: readonly UpgradeTierDefinition["cost"][number][],
): UpgradeTierDefinition[] {
	return costs.map((entry) =>
		tier(
			[
				entry,
			],
			[
				{
					type: "producer.cooldown.add",
					itemId,
					ms: -100,
				},
			],
		),
	);
}

function setLootTable(itemId: ItemId, tableId: LootTableId): UpgradeEffectDefinition {
	return {
		type: "producer.outputTable.set",
		itemId,
		tableId,
	};
}

function capacity(
	inventory: Extract<
		UpgradeEffectDefinition,
		{
			type: "inventory.capacity.add";
		}
	>["inventory"],
	slots: number,
): UpgradeEffectDefinition {
	return {
		type: "inventory.capacity.add",
		inventory,
		slots,
	};
}

function clickProducer(
	cooldownMs: number,
	output: readonly ProducerOutput[],
	mode: ProducerMode = {
		type: "infinite",
	},
	inputs: readonly NonNullable<ProducerDefinition["inputs"]>[number][] = [],
): ProducerDefinition {
	return {
		trigger: "click",
		placement: "board_then_inventory",
		output,
		cooldownMs,
		mode,
		inputs,
	};
}

function producerInput(
	itemId: ItemId,
	quantity: number,
	capacity = Math.max(quantity * 3, quantity),
): NonNullable<ProducerDefinition["inputs"]>[number] {
	return {
		itemId,
		quantity,
		capacity,
	};
}

function outputs(...entries: readonly ProducerOutput[]): ProducerOutput[] {
	return [
		...entries,
	];
}

function guaranteed(itemId: ItemId, quantity: Quantity = 1): ProducerOutput {
	return {
		type: "guaranteed",
		itemId,
		quantity,
	};
}

function chance(itemId: ItemId, probability: number, quantity: Quantity = 1): ProducerOutput {
	return {
		type: "chance",
		itemId,
		probability,
		quantity,
	};
}

function weighted(entries: readonly ProducerWeightedEntry[], rolls: Quantity = 1): ProducerOutput {
	return {
		type: "weighted",
		entries,
		rolls,
	};
}

function drops(entries: readonly ProducerWeightedEntry[]): ProducerOutput[] {
	return [
		{
			type: "weighted",
			entries,
		},
	];
}

function drop(itemId: ItemId, weight: number, quantity: Quantity = 1): ProducerWeightedEntry {
	return {
		itemId,
		weight,
		quantity,
	};
}

function empty(weight: number): ProducerWeightedEntry {
	return {
		itemId: null,
		weight,
	};
}
