import { Effect } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import {
	readItemDetailSourcesFx,
	type readItemDetailSourcesFx as Sources,
} from "~/engine/item-detail/read/readItemDetailSourcesFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";

const item = (id: string, title = id) => ({
	uid: id,
	id,
	type: "simple" as const,
	title,
	description: id,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	scope: "any" as const,
	maxStackSize: 10,
});

const drop = (itemId: string, min = 1, max = min) => ({
	itemId,
	quantity: {
		min,
		max,
	},
	rules: [],
});

const guaranteedOutput = (itemId: string) => ({
	set: [
		{
			roll: [
				{
					type: "guaranteed" as const,
					drop: [
						drop(itemId),
					],
				},
			],
		},
	],
});

const targetOutput = {
	set: [
		{
			weight: 3,
			roll: [
				{
					type: "guaranteed" as const,
					drop: [
						drop("target", 2),
					],
				},
				{
					type: "chance" as const,
					chance: 0.65,
					drop: [
						drop("target", 1, 4),
					],
				},
			],
		},
		{
			weight: 1,
			roll: [
				{
					type: "guaranteed" as const,
					drop: [
						drop("byproduct"),
					],
				},
			],
		},
	],
};

const targetLine = ({
	id,
	show = true,
	showWhen,
}: {
	readonly id: string;
	readonly show?: boolean;
	readonly showWhen?: string;
}) => ({
	id,
	title: id,
	description: id,
	show,
	enable: false,
	runtimeMs: 1_000,
	input: [
		{
			type: "simple" as const,
		},
	],
	output: targetOutput,
	rules:
		showWhen === undefined
			? []
			: [
					{
						type: "show" as const,
						when: [
							{
								type: "exists" as const,
								query: {
									scope: "any" as const,
									selector: {
										type: "item" as const,
										itemId: showWhen,
									},
								},
							},
						],
					},
				],
});

const producer = (id: string, title: string, lines: readonly object[]) => ({
	...item(id, title),
	type: "producer" as const,
	scope: "board" as const,
	maxStackSize: 1,
	maxQueueSize: 1,
	lines,
});

const acquisitionLine = (id: string, outputItemId: string) => ({
	id,
	title: id,
	description: id,
	runtimeMs: 1_000,
	input: [
		{
			type: "simple" as const,
		},
	],
	output: guaranteedOutput(outputItemId),
	rules: [],
});

export const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:sources",
		title: "Sources",
		board: {
			width: 5,
			height: 5,
		},
		inventory: {
			width: 5,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		target: item("target"),
		byproduct: item("byproduct"),
		permit: item("permit"),
		product: item("product"),
		alpha: producer("alpha", "Alpha", [
			targetLine({
				id: "line:hidden",
				show: false,
				showWhen: "permit",
			}),
			targetLine({
				id: "line:alpha:first",
			}),
			targetLine({
				id: "line:alpha:second",
			}),
		]),
		beta: producer("beta", "Beta", [
			targetLine({
				id: "line:beta",
			}),
		]),
		irrelevant: producer("irrelevant", "Irrelevant", [
			acquisitionLine("line:irrelevant", "byproduct"),
		]),
		blueprint: {
			...item("blueprint", "Blueprint"),
			type: "blueprint",
			charges: {
				amount: 1,
			},
			maxStackSize: 1,
			line: {
				...acquisitionLine("line:blueprint", "product"),
				input: [
					{
						type: "simple",
						charges: {
							from: "self",
							cost: 1,
						},
					},
				],
			},
		},
		"town-hall": producer("town-hall", "Town Hall", [
			acquisitionLine("line:town-hall:blueprint", "blueprint"),
		]),
	},
});

export const runtimeItem = ({
	definition,
	id,
	location,
}: {
	readonly definition: keyof typeof config.items;
	readonly id: string;
	readonly location: RuntimeItemSchema.Type["location"];
}): RuntimeItemSchema.Type => ({
	id,
	item: config.items[definition],
	location,
	quantity: 1,
	revision: `revision:${id}`,
});

export const runtime = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 2,
	items: [
		runtimeItem({
			definition: "target",
			id: "runtime:target",
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "alpha",
			id: "runtime:alpha:space-0",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "beta",
			id: "runtime:beta:current",
			location: {
				scope: "board",
				space: 2,
				position: {
					x: 1,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "alpha",
			id: "runtime:alpha:space-3",
			location: {
				scope: "board",
				space: 3,
				position: {
					x: 2,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "alpha",
			id: "runtime:alpha:stored",
			location: {
				scope: "toolbar",
				position: {
					x: 0,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "irrelevant",
			id: "runtime:irrelevant",
			location: {
				scope: "board",
				space: 2,
				position: {
					x: 3,
					y: 0,
				},
			},
		}),
	],
	jobs: [],
	jobQueue: [],
	defaultLineByOwnerItemId: {},
} satisfies RuntimeSchema.Type;

export const readSources = (
	target: Sources.Props["target"],
	currentRuntime: RuntimeSchema.Type = runtime,
) =>
	Effect.runSync(
		readItemDetailSourcesFx({
			target,
			runtime: currentRuntime,
		}).pipe(Effect.provideService(GameConfigFx, config)),
	);
