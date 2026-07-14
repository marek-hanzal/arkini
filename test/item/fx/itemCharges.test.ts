import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readLineRunFx } from "~/v1/line/fx/run/readLineRunFx";
import { checkRuntimeFx } from "~/v1/runtime/check/checkRuntimeFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";

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
	start: {},
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
				current = yield* readRuntimeFx();
				expect(current.items.find((item) => item.id === shrine.id)?.remainingCharges).toBe(
					0,
				);
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.id === "runtime:shrine")).toBe(false);
		expect(runtime.items.filter((item) => item.item.id === "item:gift")).toHaveLength(2);
		expect(runtime.items.filter((item) => item.item.id === "item:dust")).toHaveLength(1);
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
					reason: "missing-config",
				}),
				expect.objectContaining({
					itemId: "runtime:full-state",
					reason: "full-state",
				}),
				expect.objectContaining({
					itemId: "runtime:exceeds",
					reason: "exceeds-amount",
				}),
				expect.objectContaining({
					itemId: "runtime:depleted",
					reason: "depleted-idle",
				}),
			]),
		);
	});
});
