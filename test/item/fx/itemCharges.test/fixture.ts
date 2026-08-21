import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startLineRuntimeFx } from "~/engine/job/fx/startLineRuntimeFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import { readLineRunFx } from "~/engine/line/fx/run/readLineRunFx";
import { checkRuntimeFx } from "~/engine/runtime/check/checkRuntimeFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { readCommittedTransitionFx } from "~/engine/runtime/read/readCommittedTransitionFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { StateSchema } from "~/engine/state/schema/StateSchema";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { ItemChargesIssueReasonEnumSchema } from "~/engine/runtime/schema/check/ItemChargesIssueReasonEnumSchema";

export {
	Effect,
	GameConfigSchema,
	GameEventEnumSchema,
	ItemChargesIssueReasonEnumSchema,
	Result,
	RuntimeCheckIssueEnumSchema,
	StateSchema,
	checkRuntimeFx,
	describe,
	expect,
	fromRuntimeFx,
	fromStateFx,
	it,
	readCommittedTransitionFx,
	readLineRunFx,
	readRuntimeFx,
	runTickRuntimeByFx,
	spawnItemFx,
	startLineFx,
	startLineRuntimeFx,
	useGameFx,
};

export type { RuntimeSchema };

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

export const targetChargeInput = (itemId: string) => ({
	type: "deposit" as const,
	query: {
		scope: "board" as const,
		selector: {
			type: "item" as const,
			itemId,
		},
		distance: "close" as const,
	},
	charges: {
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
		default: [
			`asset:${id}`,
		],
	},
	scope,
	maxStackSize,
});

export const chargesConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:item-charges",
		title: "Item charges",
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
			type: "producer",
			charges: {
				amount: 2,
				output: output("item:dust"),
			},
			maxQueueSize: 2,
			lines: [
				{
					id: "line:shrine:pray",
					title: "Pray",
					description: "Use one shrine charge.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							charges: {
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
			type: "producer",
			maxQueueSize: 1,
			lines: [
				{
					id: "line:double-target:work",
					title: "Double work",
					description: "Spend two target costs.",
					runtimeMs: 200,
					input: [
						targetChargeInput("deposit:tree"),
						targetChargeInput("deposit:tree"),
					],
					rules: [],
				},
				{
					id: "line:double-target:saplings",
					title: "Double sapling work",
					description: "Spend two sapling target costs.",
					runtimeMs: 200,
					input: [
						targetChargeInput("deposit:sapling"),
						targetChargeInput("deposit:sapling"),
					],
					rules: [],
				},
			],
		},
		"producer:mixed-charge": {
			...base({
				id: "producer:mixed-charge",
				maxStackSize: 2,
			}),
			type: "producer",
			charges: {
				amount: 2,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:mixed-charge:work",
					title: "Mixed charge",
					description: "Spend self and target charges.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							charges: {
								from: "self",
								cost: 1,
							},
						},
						{
							type: "deposit",
							query: {
								scope: "board",
								selector: {
									type: "item",
									itemId: "deposit:empty",
								},
								distance: "close",
							},
							charges: {
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
			type: "producer",
			charges: {
				amount: 1,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:overdrawn:work",
					title: "Overdrawn",
					description: "Costs two charges but owns one.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							charges: {
								from: "self",
								cost: 1,
							},
						},
						{
							type: "simple",
							charges: {
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
			type: "producer",
			maxQueueSize: 1,
			lines: [
				{
					id: "line:lumberjack:work",
					title: "Work",
					description: "Spend one nearby target charge.",
					runtimeMs: 200,
					input: [
						targetChargeInput("deposit:tree"),
					],
					output: output("item:log"),
					rules: [],
				},
				{
					id: "line:lumberjack:sapling",
					title: "Sapling work",
					description: "Spend one nearby sapling charge.",
					runtimeMs: 200,
					input: [
						targetChargeInput("deposit:sapling"),
					],
					output: output("item:log"),
					rules: [],
				},
				{
					id: "line:lumberjack:messy",
					title: "Messy work",
					description: "Spend one nearby messy deposit charge.",
					runtimeMs: 200,
					input: [
						targetChargeInput("deposit:messy"),
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
			type: "producer",
			charges: {
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
							charges: {
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
			type: "producer",
			maxQueueSize: 1,
			lines: [
				{
					id: "line:capped-lumberjack:work",
					title: "Capped lumberjack",
					description: "Deplete one capped sapling.",
					runtimeMs: 200,
					input: [
						{
							type: "deposit",
							query: {
								scope: "board",
								selector: {
									type: "item",
									itemId: "deposit:capped-sapling",
								},
								distance: "close",
							},
							charges: {
								from: "target",
								cost: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		"deposit:self-well": {
			...base({
				id: "deposit:self-well",
			}),
			type: "deposit",
			charges: {
				amount: 2,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:self-well:water",
					title: "Water",
					description: "Spend one charge from this well.",
					runtimeMs: 200,
					input: [
						{
							type: "deposit",
							query: {
								scope: "board",
								selector: {
									type: "item",
									itemId: "deposit:self-well",
								},
								distance: "self",
							},
							charges: {
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
		"deposit:tree": {
			...base({
				id: "deposit:tree",
				maxStackSize: 3,
			}),
			type: "deposit",
			charges: {
				amount: 2,
			},
		},
		"deposit:sapling": {
			...base({
				id: "deposit:sapling",
				maxStackSize: 3,
			}),
			type: "deposit",
			charges: {
				amount: 1,
				output: output("item:seed"),
			},
		},
		"deposit:capped-sapling": {
			...base({
				id: "deposit:capped-sapling",
			}),
			type: "deposit",
			charges: {
				amount: 1,
				output: output("item:capped-seed"),
			},
		},
		"deposit:empty": {
			...base({
				id: "deposit:empty",
			}),
			type: "deposit",
			charges: {
				amount: 1,
			},
		},
		"deposit:messy": {
			...base({
				id: "deposit:messy",
			}),
			type: "deposit",
			charges: {
				amount: 1,
				output: output("item:seed", "item:trash"),
			},
		},
		"item:gift": {
			...base({
				id: "item:gift",
			}),
			type: "simple",
		},
		"item:dust": {
			...base({
				id: "item:dust",
			}),
			type: "simple",
		},
		"item:log": {
			...base({
				id: "item:log",
			}),
			type: "simple",
		},
		"item:seed": {
			...base({
				id: "item:seed",
			}),
			type: "simple",
		},
		"item:trash": {
			...base({
				id: "item:trash",
			}),
			type: "simple",
		},
		"item:capped-gift": {
			...base({
				id: "item:capped-gift",
			}),
			type: "simple",
			maxCount: 1,
		},
		"item:capped-seed": {
			...base({
				id: "item:capped-seed",
			}),
			type: "simple",
			maxCount: 1,
		},
		"item:blocker": {
			...base({
				id: "item:blocker",
				scope: "any",
			}),
			type: "simple",
		},
	},
});

export const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: chargesConfig,
			}),
		) as Effect.Effect<A, E, never>,
	);

export const board = (x: number, y = 0) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y,
	},
});
