import { createItemBase } from "~test/game-config-validation/support/gameValidationTestSource";
import { Effect } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import {
	readItemDetailSourcesFx,
	type readItemDetailSourcesFx as Sources,
} from "~/item-detail-read/fx/readItemDetailSourcesFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const item = (id: string, title = id) => ({
	maxQueueSize: 1,
	lines: [],

	uid: id,

	title,
	description: id,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

const drop = (itemUid: string, min = 1, max = min) => ({
	type: "item" as const,
	itemUid,
	quantity: {
		min,
		max,
	},
	rules: [],
});

const guaranteedOutput = (itemUid: string) => ({
	set: [
		{
			rules: [],
			roll: [
				{
					type: "guaranteed" as const,
					outcome: [
						drop(itemUid),
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
			rules: [],
			roll: [
				{
					type: "guaranteed" as const,
					outcome: [
						drop("target", 2),
					],
				},
				{
					type: "chance" as const,
					chance: 0.65,
					outcome: [
						drop("target", 1, 4),
					],
				},
			],
		},
		{
			weight: 1,
			rules: [],
			roll: [
				{
					type: "guaranteed" as const,
					outcome: [
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
	uid: id,
	title: id,
	description: id,
	show,
	enable: false,
	runtimeMs: 1_000,
	input: [],
	outcome: targetOutput,
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
									distance: "far",
									selector: {
										type: "item" as const,
										itemUid: showWhen,
									},
								},
							},
						],
					},
				],
});

const producer = (id: string, title: string, lines: readonly object[]) => ({
	...item(id, title),
	maxQueueSize: 1,
	lines,
});

const acquisitionLine = (id: string, outputItemId: string) => ({
	uid: id,
	title: id,
	description: id,
	runtimeMs: 1_000,
	input: [],
	outcome: guaranteedOutput(outputItemId),
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
	},
	start: {
		currentSpace: 0,
		spaces: [],
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
			...createItemBase("blueprint"),
			title: "Blueprint",
			maxQueueSize: 1,

			units: {
				amount: 1,
			},
			lines: [
				{
					...acquisitionLine("line:blueprint", "product"),
					input: [
						{
							type: "units" as const,
							query: {
								distance: "self" as const,
								selector: {
									type: "item" as const,
									itemUid: "blueprint",
								},
							},
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
				},
			],
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
	revision: `revision:${id}`,
});

export const runtime = {
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace: 2,
	templateUidBySpace: {},
	items: [
		runtimeItem({
			definition: "target",
			id: "runtime:target",
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
				scope: "input",
				ownerItemId: "runtime:beta:current",
				lineUid: "line:beta",
				inputIndex: 0,
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
