import type { DevScenarioDefinition } from "~/v0/debug/scenario/DevScenarioDefinition";

export const DevScenarioDefinitions = [
	{
		id: "empty-board",
		label: "Empty board",
		description: "Clean board and empty inventory. Useful when the save itself is guilty.",
		board: [],
		inventory: [],
	},
	{
		id: "swap-board-items",
		label: "Swap board items",
		description:
			"Twig and pebble on adjacent board cells. Drag one onto the other; both should settle in parallel.",
		board: [
			{
				id: "scenario:swap-board-items:board:twig",
				itemId: "item:twig",
				x: 2,
				y: 4,
			},
			{
				id: "scenario:swap-board-items:board:pebble",
				itemId: "item:pebble",
				x: 4,
				y: 4,
			},
		],
		inventory: [],
	},
	{
		id: "merge-two-twigs",
		label: "Merge two twigs",
		description:
			"Two mergeable twigs on the board. Drag either one onto the other; target should become branch cleanly.",
		board: [
			{
				id: "scenario:merge-two-twigs:board:left",
				itemId: "item:twig",
				x: 2,
				y: 4,
			},
			{
				id: "scenario:merge-two-twigs:board:right",
				itemId: "item:twig",
				x: 4,
				y: 4,
			},
		],
		inventory: [],
	},
	{
		id: "drag-merge-feedback",
		label: "Drag merge feedback",
		description:
			"Two mergeable twigs, one blocked pebble, and empty cells. Drag the left twig over the right twig, pebble, and empty cells to capture hover feedback.",
		board: [
			{
				id: "scenario:drag-merge-feedback:board:twig-left",
				itemId: "item:twig",
				x: 2,
				y: 4,
			},
			{
				id: "scenario:drag-merge-feedback:board:twig-right",
				itemId: "item:twig",
				x: 4,
				y: 4,
			},
			{
				id: "scenario:drag-merge-feedback:board:pebble",
				itemId: "item:pebble",
				x: 5,
				y: 4,
			},
		],
		inventory: [],
	},
	{
		id: "producer-single-spawn",
		label: "Producer single spawn",
		description:
			"Ready Town Hall with empty space. Tap it once; outputs should appear as one activation batch.",
		board: [
			{
				id: "scenario:producer-single-spawn:board:townhall",
				itemId: "item:townhall-1",
				x: 3,
				y: 4,
			},
		],
		inventory: [],
	},
	{
		id: "stash-exhaust-sequence",
		label: "Stash exhaust sequence",
		description:
			"Common Crate with all charges. Exhaust it; spawned items should stream one by one, not teleport as a lump.",
		board: [
			{
				id: "scenario:stash-exhaust-sequence:board:crate",
				itemId: "item:crate-1",
				x: 3,
				y: 4,
			},
		],
		inventory: [],
	},
	{
		id: "inventory-stack-stash",
		label: "Board to inventory stack",
		description:
			"Twig on board plus twig stack in inventory slot 0. Stash the board twig; stack quantity should animate/report cleanly.",
		board: [
			{
				id: "scenario:inventory-stack-stash:board:twig",
				itemId: "item:twig",
				x: 3,
				y: 4,
			},
		],
		inventory: [
			{
				id: "scenario:inventory-stack-stash:inventory:twig",
				itemId: "item:twig",
				slotIndex: 0,
				quantity: 2,
			},
		],
	},
	{
		id: "inventory-to-board",
		label: "Inventory to board",
		description:
			"Twig stack in inventory slot 0 and empty board. Place one onto board; size handoff should stay sane.",
		board: [],
		inventory: [
			{
				id: "scenario:inventory-to-board:inventory:twig",
				itemId: "item:twig",
				slotIndex: 0,
				quantity: 3,
			},
		],
	},
	{
		id: "full-ish-board",
		label: "Full-ish board",
		description:
			"Busy board with several item classes. Useful for overlap, z-index and target resolution bugs.",
		board: [
			{
				id: "scenario:full-ish-board:board:townhall",
				itemId: "item:townhall-1",
				x: 3,
				y: 4,
			},
			{
				id: "scenario:full-ish-board:board:lumber-camp",
				itemId: "item:lumber-camp-1",
				x: 1,
				y: 4,
			},
			{
				id: "scenario:full-ish-board:board:quarry",
				itemId: "item:quarry-1",
				x: 5,
				y: 4,
			},
			{
				id: "scenario:full-ish-board:board:crate",
				itemId: "item:crate-1",
				x: 3,
				y: 6,
			},
			{
				id: "scenario:full-ish-board:board:twig-a",
				itemId: "item:twig",
				x: 2,
				y: 2,
			},
			{
				id: "scenario:full-ish-board:board:twig-b",
				itemId: "item:twig",
				x: 4,
				y: 2,
			},
			{
				id: "scenario:full-ish-board:board:pebble",
				itemId: "item:pebble",
				x: 3,
				y: 2,
			},
		],
		inventory: [
			{
				id: "scenario:full-ish-board:inventory:twig",
				itemId: "item:twig",
				slotIndex: 0,
				quantity: 5,
			},
			{
				id: "scenario:full-ish-board:inventory:water",
				itemId: "item:water",
				slotIndex: 1,
				quantity: 2,
			},
			{
				id: "scenario:full-ish-board:inventory:crate",
				itemId: "item:crate-1",
				slotIndex: 2,
				quantity: 1,
			},
		],
	},
] as const satisfies readonly DevScenarioDefinition[];

export type DevScenarioId = (typeof DevScenarioDefinitions)[number]["id"];

export const DevScenarioById = DevScenarioDefinitions.reduce(
	(index, scenario) => ({
		...index,
		[scenario.id]: scenario,
	}),
	{} as Record<DevScenarioId, DevScenarioDefinition>,
);

export const isDevScenarioId = (scenarioId: string): scenarioId is DevScenarioId =>
	scenarioId in DevScenarioById;
