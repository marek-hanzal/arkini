import { Effect, type Layer, Result } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import type { GameLayerFx } from "~test/support/GameLayerFx";
import { startLineRuntimeFx } from "~/production-job/fx/startLineRuntimeFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { resolveLineRunFx } from "~/production-line/fx/resolveLineRunFx";
import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { ItemUnitsIssueReasonEnumSchema } from "~/game-runtime/schema/ItemUnitsIssueReasonEnumSchema";

export {
	Effect,
	GameConfigSchema,
	GameEventEnumSchema,
	ItemUnitsIssueReasonEnumSchema,
	Result,
	RuntimeCheckIssueEnumSchema,
	StateSchema,
	checkRuntimeFx,
	describe,
	expect,
	fromRuntimeFn,
	fromStateFx,
	it,
	CommittedTransitionsFx,
	readRuntimeFx,
	runTickRuntimeByFx,
	spawnItemFx,
	startLineFx,
	startLineRuntimeFx,
	useGameFx,
};

export type { RuntimeSchema };

export const readLineRunFx = ({
	lineId,
	ownerItemId,
}: {
	readonly lineId: string;
	readonly ownerItemId: string;
}) =>
	Effect.gen(function* () {
		return yield* resolveLineRunFx({
			lineId,
			ownerItemId,
			runtime: yield* readRuntimeFx(),
		});
	});

export const value = (value: number) => ({
	min: value,
	max: value,
});

export const drop = (itemId: string) => ({
	itemId,
	quantity: value(1),
	placement: "drop" as const,
	rules: [],
});

export const output = (...itemIds: string[]) => ({
	set: [
		{
			roll: [
				{
					type: "guaranteed" as const,
					drop: itemIds.map(drop),
				},
			],
		},
	],
});

export const targetUnitInput = (itemId: string) => ({
	type: "units" as const,
	query: {
		scope: "board" as const,
		selector: {
			type: "item" as const,
			itemId,
		},
		distance: "close" as const,
	},
	units: {
		from: "target" as const,
		cost: 1,
	},
});

export const base = ({
	id,
	maxStackSize = 1,
	scope = "board",
}: {
	id: string;
	maxStackSize?: number;
	scope?: "any" | "board";
}) => ({
	uid: id,
	id,
	title: id,
	description: id,
	asset: {
		scale: 0.8,
		default: [
			`asset:${id}`,
		],
	},
	scope,
	maxStackSize,
});

export const unitsConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:item-units",
		title: "Item units",
		board: {
			width: 4,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		"producer:shrine": {
			...base({
				id: "producer:shrine",
				maxStackSize: 3,
			}),

			units: {
				amount: 2,
				output: output("item:dust"),
			},
			maxQueueSize: 2,
			lines: [
				{
					id: "line:shrine:pray",
					title: "Pray",
					description: "Use one shrine unit.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					output: output("item:gift"),
					rules: [],
				},
			],
		},
		"producer:double-target": {
			...base({
				id: "producer:double-target",
			}),

			maxQueueSize: 1,
			lines: [
				{
					id: "line:double-target:work",
					title: "Double work",
					description: "Spend two target costs.",
					runtimeMs: 200,
					input: [
						targetUnitInput("units:tree"),
						targetUnitInput("units:tree"),
					],
					rules: [],
				},
				{
					id: "line:double-target:saplings",
					title: "Double sapling work",
					description: "Spend two sapling target costs.",
					runtimeMs: 200,
					input: [
						targetUnitInput("units:sapling"),
						targetUnitInput("units:sapling"),
					],
					rules: [],
				},
			],
		},
		"producer:mixed-unit": {
			...base({
				id: "producer:mixed-unit",
				maxStackSize: 2,
			}),

			units: {
				amount: 2,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:mixed-unit:work",
					title: "Mixed unit",
					description: "Spend self and target units.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
						{
							type: "units",
							query: {
								scope: "board",
								selector: {
									type: "item",
									itemId: "units:empty",
								},
								distance: "close",
							},
							units: {
								from: "target",
								cost: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		"producer:overdrawn": {
			...base({
				id: "producer:overdrawn",
			}),

			units: {
				amount: 1,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:overdrawn:work",
					title: "Overdrawn",
					description: "Costs two units but owns one.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		"producer:lumberjack": {
			...base({
				id: "producer:lumberjack",
			}),

			maxQueueSize: 1,
			lines: [
				{
					id: "line:lumberjack:work",
					title: "Work",
					description: "Spend one nearby target unit.",
					runtimeMs: 200,
					input: [
						targetUnitInput("units:tree"),
					],
					output: output("item:log"),
					rules: [],
				},
				{
					id: "line:lumberjack:sapling",
					title: "Sapling work",
					description: "Spend one nearby sapling unit.",
					runtimeMs: 200,
					input: [
						targetUnitInput("units:sapling"),
					],
					output: output("item:log"),
					rules: [],
				},
				{
					id: "line:lumberjack:messy",
					title: "Messy work",
					description: "Spend one nearby messy units unit.",
					runtimeMs: 200,
					input: [
						targetUnitInput("units:messy"),
					],
					output: output("item:log"),
					rules: [],
				},
			],
		},
		"producer:capped-shrine": {
			...base({
				id: "producer:capped-shrine",
			}),

			units: {
				amount: 1,
				output: output("item:capped-gift"),
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:capped-shrine:work",
					title: "Capped shrine",
					description: "Both completion outputs share one max count.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					output: output("item:capped-gift"),
					rules: [],
				},
			],
		},
		"producer:capped-lumberjack": {
			...base({
				id: "producer:capped-lumberjack",
			}),

			maxQueueSize: 1,
			lines: [
				{
					id: "line:capped-lumberjack:work",
					title: "Capped lumberjack",
					description: "Deplete one capped sapling.",
					runtimeMs: 200,
					input: [
						{
							type: "units",
							query: {
								scope: "board",
								selector: {
									type: "item",
									itemId: "units:capped-sapling",
								},
								distance: "close",
							},
							units: {
								from: "target",
								cost: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		"units:self-well": {
			...base({
				id: "units:self-well",
			}),

			units: {
				amount: 2,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:self-well:water",
					title: "Water",
					description: "Spend one unit from this well.",
					runtimeMs: 200,
					input: [
						{
							type: "units",
							query: {
								scope: "board",
								selector: {
									type: "item",
									itemId: "units:self-well",
								},
								distance: "self",
							},
							units: {
								from: "target",
								cost: 1,
							},
						},
					],
					output: output("item:gift"),
					rules: [],
				},
			],
		},
		"units:tree": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "units:tree",
				maxStackSize: 3,
			}),

			units: {
				amount: 2,
			},
		},
		"units:sapling": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "units:sapling",
				maxStackSize: 3,
			}),

			units: {
				amount: 1,
				output: output("item:seed"),
			},
		},
		"units:capped-sapling": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "units:capped-sapling",
			}),

			units: {
				amount: 1,
				output: output("item:capped-seed"),
			},
		},
		"units:empty": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "units:empty",
			}),

			units: {
				amount: 1,
			},
		},
		"units:messy": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "units:messy",
			}),

			units: {
				amount: 1,
				output: output("item:seed", "item:trash"),
			},
		},
		"item:gift": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "item:gift",
			}),
		},
		"item:dust": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "item:dust",
			}),
		},
		"item:log": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "item:log",
			}),
		},
		"item:seed": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "item:seed",
			}),
		},
		"item:trash": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "item:trash",
			}),
		},
		"item:capped-gift": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "item:capped-gift",
			}),

			maxCount: 1,
		},
		"item:capped-seed": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "item:capped-seed",
			}),

			maxCount: 1,
		},
		"item:blocker": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "item:blocker",
				scope: "any",
			}),
		},
	},
});

export const run = <A, E>(
	effect: Effect.Effect<A, E, Layer.Success<ReturnType<typeof GameLayerFx>>>,
) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: unitsConfig,
			}),
		),
	);

export const board = (x: number, y = 0) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y,
	},
});
