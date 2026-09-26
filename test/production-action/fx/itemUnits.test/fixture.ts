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
	lineUid,
	ownerItemId,
}: {
	readonly lineUid: string;
	readonly ownerItemId: string;
}) =>
	Effect.gen(function* () {
		return yield* resolveLineRunFx({
			lineUid,
			ownerItemId,
			runtime: yield* readRuntimeFx(),
		});
	});

export const value = (value: number) => ({
	min: value,
	max: value,
});

export const drop = (itemId: string) => ({
	type: "item" as const,
	itemUid: itemId,
	quantity: value(1),
	placement: "drop" as const,
	rules: [],
});

export const outcome = (...itemIds: string[]) => ({
	set: [
		{
			rules: [],
			roll: [
				{
					type: "guaranteed" as const,
					outcome: itemIds.map(drop),
				},
			],
		},
	],
});

export const targetUnitInput = (itemId: string) => ({
	type: "units" as const,
	query: {
		selector: {
			type: "item" as const,
			itemUid: itemId,
		},
		distance: "close" as const,
	},
	units: {
		from: "target" as const,
		cost: 1,
	},
});

export const base = ({ id }: { id: string }) => ({
	uid: id,

	title: id,
	description: id,
	ui: "default" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

const terminationLineFn = (uid: string, result: ReturnType<typeof outcome>) => ({
	uid,
	title: "Depletion",
	trigger: "item-termination" as const,
	runtimeMs: 0,
	input: [],
	outcome: result,
	rules: [],
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
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		"producer:shrine": {
			...base({
				id: "producer:shrine",
			}),

			units: {
				amount: 2,
			},
			maxQueueSize: 2,
			lines: [
				terminationLineFn("line:shrine:depletion", outcome("item:dust")),
				{
					uid: "line:shrine:pray",
					title: "Pray",
					description: "Use one shrine unit.",
					runtimeMs: 200,
					input: [
						{
							type: "units" as const,
							query: {
								distance: "self" as const,
								selector: {
									type: "item" as const,
									itemUid: "producer:shrine",
								},
							},
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					outcome: outcome("item:gift"),
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
					uid: "line:double-target:work",
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
					uid: "line:double-target:saplings",
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
			}),

			units: {
				amount: 2,
			},
			maxQueueSize: 1,
			lines: [
				{
					uid: "line:mixed-unit:work",
					title: "Mixed unit",
					description: "Spend self and target units.",
					runtimeMs: 200,
					input: [
						{
							type: "units" as const,
							query: {
								distance: "self" as const,
								selector: {
									type: "item" as const,
									itemUid: "producer:mixed-unit",
								},
							},
							units: {
								from: "self",
								cost: 1,
							},
						},
						{
							type: "units",
							query: {
								selector: {
									type: "item",
									itemUid: "units:empty",
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
					uid: "line:overdrawn:work",
					title: "Overdrawn",
					description: "Costs two units but owns one.",
					runtimeMs: 200,
					input: [
						{
							type: "units" as const,
							query: {
								distance: "self" as const,
								selector: {
									type: "item" as const,
									itemUid: "producer:overdrawn",
								},
							},
							units: {
								from: "self",
								cost: 1,
							},
						},
						{
							type: "units" as const,
							query: {
								distance: "self" as const,
								selector: {
									type: "item" as const,
									itemUid: "producer:overdrawn",
								},
							},
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
					uid: "line:lumberjack:work",
					title: "Work",
					description: "Spend one nearby target unit.",
					runtimeMs: 200,
					input: [
						targetUnitInput("units:tree"),
					],
					outcome: outcome("item:log"),
					rules: [],
				},
				{
					uid: "line:lumberjack:sapling",
					title: "Sapling work",
					description: "Spend one nearby sapling unit.",
					runtimeMs: 200,
					input: [
						targetUnitInput("units:sapling"),
					],
					outcome: outcome("item:log"),
					rules: [],
				},
				{
					uid: "line:lumberjack:messy",
					title: "Messy work",
					description: "Spend one nearby messy units unit.",
					runtimeMs: 200,
					input: [
						targetUnitInput("units:messy"),
					],
					outcome: outcome("item:log"),
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
					uid: "line:self-well:water",
					title: "Water",
					description: "Spend one unit from this well.",
					runtimeMs: 200,
					input: [
						{
							type: "units",
							query: {
								selector: {
									type: "item",
									itemUid: "units:self-well",
								},
								distance: "self",
							},
							units: {
								from: "target",
								cost: 1,
							},
						},
					],
					outcome: outcome("item:gift"),
					rules: [],
				},
			],
		},
		"units:tree": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "units:tree",
			}),

			units: {
				amount: 2,
			},
		},
		"units:sapling": {
			maxQueueSize: 1,
			lines: [
				terminationLineFn("line:sapling:depletion", outcome("item:seed")),
			],

			...base({
				id: "units:sapling",
			}),

			units: {
				amount: 1,
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
			lines: [
				terminationLineFn("line:messy:depletion", outcome("item:seed", "item:trash")),
			],

			...base({
				id: "units:messy",
			}),

			units: {
				amount: 1,
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
		"item:blocker": {
			maxQueueSize: 1,
			lines: [],

			...base({
				id: "item:blocker",
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
