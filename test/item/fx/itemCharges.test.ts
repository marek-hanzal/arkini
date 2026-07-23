import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startLineRuntimeFx } from "~/engine/job/fx/startLineRuntimeFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
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

const value = (value: number) => ({
	type: "value" as const,
	value,
});
const drop = (itemId: string) => ({
	itemId,
	quantity: value(1),
	placement: "drop" as const,
	rules: [],
});
const output = (...itemIds: string[]) => ({
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
const base = ({
	id,
	maxStackSize = 1,
	scope = "board",
}: {
	id: string;
	maxStackSize?: number;
	scope?: "any" | "board";
}) => ({
	id,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags: [],
	categoryId: "test",
	scope,
	maxStackSize,
});

const chargesConfig = GameConfigSchema.parse({
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
	categories: {},
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
						{
							type: "deposit",
							query: {
								scope: "board",
								selector: {
									type: "tag",
									tag: "wood-source",
								},
								distance: "close",
							},
							charges: {
								from: "target",
								cost: 1,
							},
						},
						{
							type: "deposit",
							query: {
								scope: "board",
								selector: {
									type: "tag",
									tag: "wood-source",
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
						{
							type: "deposit",
							query: {
								scope: "board",
								selector: {
									type: "tag",
									tag: "wood-source",
								},
								distance: "close",
							},
							charges: {
								from: "target",
								cost: 1,
							},
						},
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
		"deposit:tree": {
			...base({
				id: "deposit:tree",
				maxStackSize: 3,
			}),
			type: "deposit",
			tags: [
				"wood-source",
			],
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
			tags: [
				"wood-source",
			],
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
			tags: [
				"wood-source",
			],
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

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: chargesConfig,
			}),
		) as Effect.Effect<A, E, never>,
	);

const board = (x: number, y = 0) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y,
	},
});

describe("item charges", () => {
	it("keeps a limited producer after a partial spend and removes it after its last job", () => {
		const runtime = run(
			Effect.gen(function* () {
				const shrine = yield* spawnItemFx({
					id: "runtime:shrine",
					itemId: "producer:shrine",
					location: board(0),
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: shrine.id,
					lineId: "line:shrine:pray",
				});
				const firstStart = yield* readCommittedTransitionFx();
				let current = yield* readRuntimeFx();
				expect(current.items.find((item) => item.id === shrine.id)?.remainingCharges).toBe(
					1,
				);
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				yield* startLineFx({
					ownerItemId: shrine.id,
					lineId: "line:shrine:pray",
				});
				const finalStart = yield* readCommittedTransitionFx();
				current = yield* readRuntimeFx();
				expect(current.items.find((item) => item.id === shrine.id)?.remainingCharges).toBe(
					0,
				);
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					finalCompletion: yield* readCommittedTransitionFx(),
					finalStart,
					firstStart,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(runtime.firstStart.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemChargeSpent,
			itemId: "runtime:shrine",
			canonicalItemId: "producer:shrine",
			location: board(0),
			previousCharges: 2,
			resultingCharges: 1,
		});
		expect(
			runtime.finalStart.events.some(
				(event) =>
					event.type === GameEventEnumSchema.enum.ItemChargeSpent ||
					event.type === GameEventEnumSchema.enum.ItemDepleted,
			),
		).toBe(false);
		expect(
			runtime.finalCompletion.events.filter(
				(event) => event.type === GameEventEnumSchema.enum.ItemDepleted,
			),
		).toHaveLength(1);
		expect(
			runtime.finalCompletion.events.some(
				(event) => event.type === GameEventEnumSchema.enum.ItemChargeSpent,
			),
		).toBe(false);
		expect(runtime.runtime.items.some((item) => item.id === "runtime:shrine")).toBe(false);
		expect(runtime.runtime.items.filter((item) => item.item.id === "item:gift")).toHaveLength(
			2,
		);
		expect(runtime.runtime.items.filter((item) => item.item.id === "item:dust")).toHaveLength(
			1,
		);
	});

	it("isolates one partially spent target from a pure charged stack", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				const tree = yield* spawnItemFx({
					id: "runtime:tree",
					itemId: "deposit:tree",
					location: board(1),
					quantity: 2,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:work",
				});
				return {
					runtime: yield* readRuntimeFx(),
					tree,
				};
			}),
		);

		const trees = runtime.runtime.items.filter((item) => item.item.id === "deposit:tree");
		expect(trees).toHaveLength(2);
		expect(trees.find((item) => item.id === runtime.tree.id)).toMatchObject({
			quantity: 1,
			remainingCharges: 1,
		});
		expect(trees.find((item) => item.id !== runtime.tree.id)).toMatchObject({
			quantity: 1,
			remainingCharges: undefined,
		});
	});

	it("reports an exact split when one charged stack identity becomes stateful", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				const tree = yield* spawnItemFx({
					id: "runtime:tree",
					itemId: "deposit:tree",
					location: board(1),
					quantity: 2,
				});
				const [, runtime, events] = yield* startLineRuntimeFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:work",
					runtime: yield* readRuntimeFx(),
				});
				return {
					events,
					runtime,
					tree,
				};
			}),
		);

		const chargeSpentIndex = result.events.findIndex(
			(event) => event.type === GameEventEnumSchema.enum.ItemChargeSpent,
		);
		const splitIndex = result.events.findIndex(
			(event) => event.type === GameEventEnumSchema.enum.ItemSplit,
		);
		expect(result.events[chargeSpentIndex]).toEqual({
			type: GameEventEnumSchema.enum.ItemChargeSpent,
			itemId: result.tree.id,
			canonicalItemId: "deposit:tree",
			location: board(1),
			previousCharges: 2,
			resultingCharges: 1,
		});
		expect(chargeSpentIndex).toBeGreaterThanOrEqual(0);
		expect(splitIndex).toBeGreaterThan(chargeSpentIndex);
		expect(result.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemSplit,
			itemId: result.tree.id,
			canonicalItemId: "deposit:tree",
			location: board(1),
			previousQuantity: 2,
			quantity: 1,
		});
		expect(result.runtime.items.filter((item) => item.item.id === "deposit:tree")).toHaveLength(
			2,
		);
	});

	it("consumes one fully depleted quantity without relocating the pure remainder", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				const sapling = yield* spawnItemFx({
					id: "runtime:sapling",
					itemId: "deposit:sapling",
					location: board(1),
					quantity: 2,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:work",
				});
				return {
					runtime: yield* readRuntimeFx(),
					sapling,
				};
			}),
		);

		expect(result.runtime.items.find((item) => item.id === result.sapling.id)).toMatchObject({
			quantity: 1,
			location: board(1),
			remainingCharges: undefined,
		});
		expect(
			result.runtime.items.filter((item) => item.item.id === "deposit:sapling"),
		).toHaveLength(1);
		expect(result.runtime.items.filter((item) => item.item.id === "item:seed")).toHaveLength(1);
	});

	it("reports quantity-one depletion plus ordinary output without inventing replacement", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				const sapling = yield* spawnItemFx({
					id: "runtime:sapling",
					itemId: "deposit:sapling",
					location: board(1),
					quantity: 1,
				});
				const [, runtime, events] = yield* startLineRuntimeFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:work",
					runtime: yield* readRuntimeFx(),
				});
				const seed = runtime.items.find((item) => item.item.id === "item:seed");
				if (seed === undefined) throw new Error("Expected depletion output seed.");
				return {
					events,
					runtime,
					sapling,
					seed,
				};
			}),
		);

		expect(result.runtime.items.some((item) => item.id === result.sapling.id)).toBe(false);
		expect(
			result.events.some((event) => event.type === GameEventEnumSchema.enum.ItemChargeSpent),
		).toBe(false);
		expect(result.events).toEqual(
			expect.arrayContaining([
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: result.sapling.id,
					canonicalItemId: "deposit:sapling",
					location: board(1),
					previousQuantity: 1,
					resultingQuantity: 0,
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: result.seed.id,
					canonicalItemId: "item:seed",
					originItemId: result.sapling.id,
					location: result.seed.location,
					quantity: 1,
				},
			]),
		);
	});

	it("reports one depleted stack quantity without falsely removing the surviving actor", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				const sapling = yield* spawnItemFx({
					id: "runtime:sapling",
					itemId: "deposit:sapling",
					location: board(1),
					quantity: 2,
				});
				const [, runtime, events] = yield* startLineRuntimeFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:work",
					runtime: yield* readRuntimeFx(),
				});
				return {
					events,
					runtime,
					sapling,
				};
			}),
		);

		expect(result.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemDepleted,
			itemId: result.sapling.id,
			canonicalItemId: "deposit:sapling",
			location: board(1),
			previousQuantity: 2,
			resultingQuantity: 1,
		});
		expect(result.runtime.items.find((item) => item.id === result.sapling.id)).toMatchObject({
			quantity: 1,
			location: board(1),
		});
	});

	it("rolls back the whole start when depletion output cannot be placed", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:messy",
					itemId: "deposit:messy",
					location: board(1),
					quantity: 1,
				});
				for (const [id, location] of [
					[
						"runtime:blocker:2",
						board(2),
					],
					[
						"runtime:blocker:3",
						board(3),
					],
					[
						"runtime:blocker:4",
						board(0, 1),
					],
					[
						"runtime:blocker:5",
						board(1, 1),
					],
					[
						"runtime:blocker:6",
						board(2, 1),
					],
					[
						"runtime:blocker:7",
						board(3, 1),
					],
				] as const) {
					yield* spawnItemFx({
						id,
						itemId: "item:blocker",
						location,
						quantity: 1,
					});
				}
				yield* spawnItemFx({
					id: "runtime:inventory-blocker",
					itemId: "item:blocker",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					startLineFx({
						ownerItemId: owner.id,
						lineId: "line:lumberjack:work",
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		expect(result.after).toEqual(result.before);
	});

	it("resolves idle depletion before isolating a surviving charged owner", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:mixed-owner",
					itemId: "producer:mixed-charge",
					location: board(0),
					quantity: 2,
				});
				yield* spawnItemFx({
					id: "runtime:empty-target",
					itemId: "deposit:empty",
					location: board(1),
					quantity: 1,
				});
				for (const [id, location] of [
					[
						"runtime:mixed-blocker:2",
						board(2),
					],
					[
						"runtime:mixed-blocker:3",
						board(3),
					],
					[
						"runtime:mixed-blocker:4",
						board(0, 1),
					],
					[
						"runtime:mixed-blocker:5",
						board(1, 1),
					],
					[
						"runtime:mixed-blocker:6",
						board(2, 1),
					],
					[
						"runtime:mixed-blocker:7",
						board(3, 1),
					],
				] as const) {
					yield* spawnItemFx({
						id,
						itemId: "item:blocker",
						location,
						quantity: 1,
					});
				}
				yield* spawnItemFx({
					id: "runtime:mixed-inventory-blocker",
					itemId: "item:blocker",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:mixed-charge:work",
				});
				return {
					owner,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		const owners = result.runtime.items.filter(
			(item) => item.item.id === "producer:mixed-charge",
		);
		expect(owners).toHaveLength(2);
		expect(owners.find((item) => item.id === result.owner.id)).toMatchObject({
			quantity: 1,
			remainingCharges: 1,
		});
		expect(owners.find((item) => item.id !== result.owner.id)).toMatchObject({
			location: board(1),
			quantity: 1,
			remainingCharges: undefined,
		});
		expect(result.runtime.items.some((item) => item.item.id === "deposit:empty")).toBe(false);
	});

	it("keeps a line unready when aggregate self costs exceed remaining charges", () => {
		const resolution = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:overdrawn",
					itemId: "producer:overdrawn",
					location: board(0),
					quantity: 1,
				});
				return yield* readLineRunFx({
					ownerItemId: owner.id,
					lineId: "line:overdrawn:work",
				});
			}),
		);

		expect(resolution.ready).toBe(false);
		expect(resolution.input[0].resolution.ready).toBe(true);
		expect(resolution.input[1].resolution.ready).toBe(false);
		expect(resolution.plan).toBeUndefined();
	});

	it("aggregates repeated costs for one target before spending its charges", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:double-target",
					itemId: "producer:double-target",
					location: board(0),
					quantity: 1,
				});
				const tree = yield* spawnItemFx({
					id: "runtime:tree-stack",
					itemId: "deposit:tree",
					location: board(1),
					quantity: 2,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:double-target:work",
				});
				return {
					runtime: yield* readRuntimeFx(),
					tree,
				};
			}),
		);

		expect(result.runtime.items.filter((item) => item.item.id === "deposit:tree")).toEqual([
			expect.objectContaining({
				id: result.tree.id,
				location: board(1),
				quantity: 1,
				remainingCharges: undefined,
			}),
		]);
	});

	it("reserves target charges across inputs and selects the next eligible target", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:double-target",
					itemId: "producer:double-target",
					location: board(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:sapling:a",
					itemId: "deposit:sapling",
					location: board(1),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:sapling:b",
					itemId: "deposit:sapling",
					location: board(0, 1),
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:double-target:work",
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.id === "deposit:sapling")).toBe(false);
		expect(runtime.items.filter((item) => item.item.id === "item:seed")).toHaveLength(2);
	});

	it("rejects hydrated active-job output reservations that overbook maxCount", () => {
		const state = StateSchema.parse({
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				{
					id: "runtime:capped-shrine",
					itemId: "producer:capped-shrine",
					location: board(0),
					remainingCharges: 0,
					quantity: 1,
				},
			],
			jobs: [
				{
					id: "job:capped-shrine",
					ownerItemId: "runtime:capped-shrine",
					lineId: "line:capped-shrine:work",
					durationMs: 200,
					remainingMs: 200,
				},
			],
		});
		const result = run(
			Effect.either(
				fromStateFx({
					state,
				}),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: expect.arrayContaining([
						{
							itemId: "item:capped-gift",
							itemIds: [],
							jobIds: [
								"job:capped-shrine",
							],
							liveQuantity: 0,
							reservedQuantity: 2,
							maxCount: 1,
							quantity: 2,
							type: RuntimeCheckIssueEnumSchema.enum.ItemMaxCount,
						},
					]),
				},
			});
		}
	});

	it("does not reserve maxCount for queued requests before dispatch", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				{
					id: "runtime:capped-shrine",
					item: chargesConfig.items["producer:capped-shrine"],
					location: board(0),
					quantity: 1,
					revision: "revision:capped-shrine",
				},
			],
			jobs: [],
			jobQueue: [
				{
					id: "request:capped-shrine",
					ownerItemId: "runtime:capped-shrine",
					lineId: "line:capped-shrine:work",
				},
			],
		} satisfies RuntimeSchema.Type;
		const result = run(
			checkRuntimeFx({
				runtime,
			}),
		);

		expect(
			result.issues.some(
				(issue) => issue.type === RuntimeCheckIssueEnumSchema.enum.ItemMaxCount,
			),
		).toBe(false);
	});

	it("blocks a self-depleting job when line and depletion outputs exceed maxCount together", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:capped-shrine",
					itemId: "producer:capped-shrine",
					location: board(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					startLineFx({
						ownerItemId: owner.id,
						lineId: "line:capped-shrine:work",
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);

		expect(result.attempt).toEqual(
			Either.left(
				expect.objectContaining({
					_tag: "JobOutputMaxCountError",
					itemId: "item:capped-gift",
				}),
			),
		);
		expect(result.after).toEqual(result.before);
	});

	it("rolls back an external depletion when its immediate output exceeds maxCount", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:capped-lumberjack",
					itemId: "producer:capped-lumberjack",
					location: board(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:capped-sapling",
					itemId: "deposit:capped-sapling",
					location: board(1),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:capped-seed",
					itemId: "item:capped-seed",
					location: board(2),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					startLineFx({
						ownerItemId: owner.id,
						lineId: "line:capped-lumberjack:work",
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);

		expect(result.attempt).toEqual(
			Either.left(
				expect.objectContaining({
					_tag: "PlacementUnavailableError",
					reason: "item:max-count",
				}),
			),
		);
		expect(result.after).toEqual(result.before);
	});

	it("persists partial charges and restores a fresh runtime identity state", () => {
		const result = run(
			Effect.gen(function* () {
				const shrine = yield* spawnItemFx({
					id: "runtime:shrine",
					itemId: "producer:shrine",
					location: board(0),
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: shrine.id,
					lineId: "line:shrine:pray",
				});
				const runtime = yield* readRuntimeFx();
				const state = yield* fromRuntimeFx({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					restored,
					runtime,
					state,
				};
			}),
		);

		expect(
			result.state.items.find((item) => item.id === "runtime:shrine")?.remainingCharges,
		).toBe(1);
		expect(
			result.restored.items.find((item) => item.id === "runtime:shrine")?.remainingCharges,
		).toBe(1);
		expect(
			result.restored.items.find((item) => item.id === "runtime:shrine")?.revision,
		).not.toBe(result.runtime.items.find((item) => item.id === "runtime:shrine")?.revision);
	});

	it("reports non-canonical persisted charge states", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				{
					id: "runtime:missing-config",
					item: chargesConfig.items["producer:lumberjack"],
					location: board(0),
					quantity: 1,
					remainingCharges: 1,
					revision: "revision:missing-config",
				},
				{
					id: "runtime:full-state",
					item: chargesConfig.items["producer:shrine"],
					location: board(1),
					quantity: 1,
					remainingCharges: 2,
					revision: "revision:full-state",
				},
				{
					id: "runtime:exceeds",
					item: chargesConfig.items["producer:shrine"],
					location: board(2),
					quantity: 1,
					remainingCharges: 3,
					revision: "revision:exceeds",
				},
				{
					id: "runtime:depleted",
					item: chargesConfig.items["producer:shrine"],
					location: board(3),
					quantity: 1,
					remainingCharges: 0,
					revision: "revision:depleted",
				},
			],
			jobs: [],
		};
		const result = run(
			checkRuntimeFx({
				runtime,
			}),
		);

		expect(result.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "runtime:missing-config",
					reason: ItemChargesIssueReasonEnumSchema.enum.MissingConfig,
				}),
				expect.objectContaining({
					itemId: "runtime:full-state",
					reason: ItemChargesIssueReasonEnumSchema.enum.FullState,
				}),
				expect.objectContaining({
					itemId: "runtime:exceeds",
					reason: ItemChargesIssueReasonEnumSchema.enum.ExceedsAmount,
				}),
				expect.objectContaining({
					itemId: "runtime:depleted",
					reason: ItemChargesIssueReasonEnumSchema.enum.DepletedIdle,
				}),
			]),
		);
	});
});
