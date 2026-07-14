import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { completeJobRuntimeFx } from "~/v1/job/fx/completeJobRuntimeFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { placeDropFx } from "~/v1/placement/write/placeDropFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { setItemQuantityFx } from "~/v1/runtime/write/setItemQuantityFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";

const simpleItem = ({
	id,
	maxCount,
	scope = "board",
	maxStackSize = 1,
}: {
	id: string;
	maxCount?: number;
	scope?: "any" | "board";
	maxStackSize?: number;
}) => ({
	id,
	type: "simple" as const,
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
	maxCount,
	maxStackSize,
});

const blueprintItem = ({
	id,
	lineId,
	output,
	reserveTool = false,
}: {
	id: string;
	lineId: string;
	output?: unknown;
	reserveTool?: boolean;
}) => ({
	id,
	type: "blueprint" as const,
	afterCompletion: "remove" as const,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags: [],
	categoryId: "test",
	scope: "board" as const,
	maxStackSize: 1,
	line: {
		id: lineId,
		title: lineId,
		description: lineId,
		runtimeMs: 200,
		input: reserveTool
			? [
					{
						type: "materials" as const,
						selector: {
							type: "item" as const,
							itemId: "item:tool",
						},
						mode: "reserve" as const,
						quantity: {
							type: "value" as const,
							value: 1,
						},
					},
				]
			: [
					{
						type: "simple" as const,
					},
				],
		output,
		rules: [],
	},
});

const guaranteedOutput = (
	drops: ReadonlyArray<{
		itemId: string;
		quantity: unknown;
		placement?: "drop" | "replace";
	}>,
) => ({
	set: [
		{
			roll: [
				{
					type: "guaranteed" as const,
					drop: drops.map(({ itemId, quantity, placement = "drop" }) => ({
						itemId,
						quantity,
						placement,
						rules: [],
					})),
				},
			],
		},
	],
});

const blueprintOutput = (
	replacementItemId: string,
	byproducts: ReadonlyArray<{
		itemId: string;
		quantity: unknown;
	}> = [],
) =>
	guaranteedOutput([
		{
			itemId: replacementItemId,
			quantity: {
				type: "value" as const,
				value: 1,
			},
			placement: "replace",
		},
		...byproducts,
	]);

const blueprintConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:blueprint-completion",
		title: "Blueprint completion",
		board: {
			width: 3,
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
		"blueprint:plain": blueprintItem({
			id: "blueprint:plain",
			lineId: "line:blueprint:plain",
			output: blueprintOutput("item:target"),
		}),
		"blueprint:output": blueprintItem({
			id: "blueprint:output",
			lineId: "line:blueprint:output",
			output: blueprintOutput("item:target-unlimited", [
				{
					itemId: "item:byproduct",
					quantity: {
						type: "value",
						value: 1,
					},
				},
			]),
		}),
		"blueprint:reserve": blueprintItem({
			id: "blueprint:reserve",
			lineId: "line:blueprint:reserve",
			output: blueprintOutput("item:target-unlimited", [
				{
					itemId: "item:byproduct",
					quantity: {
						type: "value",
						value: 1,
					},
				},
			]),
			reserveTool: true,
		}),
		"blueprint:range": blueprintItem({
			id: "blueprint:range",
			lineId: "line:blueprint:range",
			output: blueprintOutput("item:target-unlimited", [
				{
					itemId: "item:limited",
					quantity: {
						type: "range",
						min: 1,
						max: 5,
					},
				},
			]),
		}),
		"item:target": simpleItem({
			id: "item:target",
			maxCount: 1,
		}),
		"item:target-unlimited": simpleItem({
			id: "item:target-unlimited",
		}),
		"item:byproduct": simpleItem({
			id: "item:byproduct",
			maxCount: 2,
			maxStackSize: 2,
		}),
		"item:limited": simpleItem({
			id: "item:limited",
			maxCount: 4,
		}),
		"item:tool": simpleItem({
			id: "item:tool",
		}),
		"item:blocker": simpleItem({
			id: "item:blocker",
		}),
		"item:queue-product": simpleItem({
			id: "item:queue-product",
			maxCount: 1,
		}),
		"producer:limited": {
			id: "producer:limited",
			type: "producer",
			afterCompletion: "keep",
			title: "Limited producer",
			description: "Produces one singleton output.",
			asset: {
				source: [
					"asset:producer:limited",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 2,
			lines: [
				{
					id: "line:producer:limited",
					title: "Produce",
					description: "Produce one singleton.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: guaranteedOutput([
						{
							itemId: "item:queue-product",
							quantity: {
								type: "value",
								value: 1,
							},
						},
					]),
					rules: [],
				},
			],
		},
	},
});

const spawnBlueprintFx = Effect.fn("spawnBlueprintFx")(function* ({
	id,
	itemId,
	x,
	y,
}: {
	id: string;
	itemId: "blueprint:output" | "blueprint:plain" | "blueprint:range" | "blueprint:reserve";
	x: number;
	y: number;
}) {
	return yield* spawnItemFx({
		id,
		itemId,
		location: {
			scope: "board",
			position: {
				x,
				y,
			},
		},
		quantity: 1,
	});
});

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: blueprintConfig,
			}),
		) as Effect.Effect<A, E, never>,
	);

describe("blueprint job completion", () => {
	it("replaces the blueprint at its exact cell with a new target identity", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					itemId: "blueprint:plain",
					x: 1,
					y: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:plain",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					owner,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		const target = result.runtime.items.find((item) => item.item.id === "item:target");
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items.some((item) => item.id === result.owner.id)).toBe(false);
		expect(target).toMatchObject({
			location: {
				scope: "board",
				position: {
					x: 1,
					y: 1,
				},
			},
			quantity: 1,
		});
		expect(target?.id).not.toBe(result.owner.id);
	});

	it("places target, by-products, and returned reservations in one completion", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					itemId: "blueprint:reserve",
					x: 0,
					y: 0,
				});
				const tool = yield* spawnItemFx({
					id: "runtime:tool",
					itemId: "item:tool",
					location: {
						scope: "board",
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.map((item) => item.item.id)).toEqual(
			expect.arrayContaining([
				"item:target-unlimited",
				"item:byproduct",
				"item:tool",
			]),
		);
		expect(runtime.items.some((item) => item.location.scope === "job")).toBe(false);
	});

	it("rolls back the target when a by-product cannot be placed", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					itemId: "blueprint:output",
					x: 0,
					y: 0,
				});
				for (const [index, position] of [
					{
						x: 1,
						y: 0,
					},
					{
						x: 2,
						y: 0,
					},
					{
						x: 0,
						y: 1,
					},
					{
						x: 1,
						y: 1,
					},
					{
						x: 2,
						y: 1,
					},
				].entries()) {
					yield* spawnItemFx({
						id: `runtime:byproduct-blocker:${index}`,
						itemId: "item:blocker",
						location: {
							scope: "board",
							position,
						},
						quantity: 1,
					});
				}
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:output",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.id === "blueprint:output")).toBe(true);
		expect(runtime.items.some((item) => item.item.id === "item:target-unlimited")).toBe(false);
		expect(runtime.items.some((item) => item.item.id === "item:byproduct")).toBe(false);
		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 0,
			}),
		]);
	});

	it("rolls back target and by-products when the final reservation cannot return", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					itemId: "blueprint:reserve",
					x: 0,
					y: 0,
				});
				const tool = yield* spawnItemFx({
					id: "runtime:tool",
					itemId: "item:tool",
					location: {
						scope: "board",
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				for (const [index, position] of [
					{
						x: 2,
						y: 0,
					},
					{
						x: 0,
						y: 1,
					},
					{
						x: 1,
						y: 1,
					},
					{
						x: 2,
						y: 1,
					},
				].entries()) {
					yield* spawnItemFx({
						id: `runtime:blocker:${index}`,
						itemId: "item:blocker",
						location: {
							scope: "board",
							position,
						},
						quantity: 1,
					});
				}
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.id === "blueprint:reserve")).toBe(true);
		expect(runtime.items.some((item) => item.item.id === "item:target-unlimited")).toBe(false);
		expect(runtime.items.some((item) => item.item.id === "item:byproduct")).toBe(false);
		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 0,
			}),
		]);
		expect(runtime.items.some((item) => item.location.scope === "job")).toBe(true);
	});

	it("reserves a shared target maxCount across concurrent blueprint jobs", () => {
		const result = run(
			Effect.gen(function* () {
				const first = yield* spawnBlueprintFx({
					id: "runtime:first",
					itemId: "blueprint:plain",
					x: 0,
					y: 0,
				});
				const second = yield* spawnBlueprintFx({
					id: "runtime:second",
					itemId: "blueprint:plain",
					x: 1,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: first.id,
					lineId: "line:blueprint:plain",
				});
				const secondStart = yield* startLineFx({
					ownerItemId: second.id,
					lineId: "line:blueprint:plain",
				}).pipe(Effect.either);
				const placement = yield* placeDropFx({
					originItemId: second.id,
					drop: {
						itemId: "item:target",
						quantity: {
							type: "value",
							value: 1,
						},
						placement: "drop",
						rules: [],
					},
				}).pipe(Effect.either);
				const spawned = yield* spawnItemFx({
					id: "runtime:forbidden-target",
					itemId: "item:target",
					location: {
						scope: "board",
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				}).pipe(Effect.either);
				return {
					secondStart,
					placement,
					spawned,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(Either.isLeft(result.secondStart)).toBe(true);
		if (Either.isLeft(result.secondStart)) {
			expect(result.secondStart.left).toMatchObject({
				_tag: "JobOutputMaxCountError",
				itemId: "item:target",
				maxCount: 1,
			});
		}
		expect(Either.isLeft(result.placement)).toBe(true);
		if (Either.isLeft(result.placement)) {
			expect(result.placement.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "item:max-count",
			});
		}
		expect(Either.isLeft(result.spawned)).toBe(true);
		if (Either.isLeft(result.spawned)) {
			expect(result.spawned.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "item:max-count",
			});
		}
		expect(result.runtime.jobs).toHaveLength(1);
	});

	it("prevents direct quantity replacement from consuming output capacity promised to a job", () => {
		const result = run(
			Effect.gen(function* () {
				const byproduct = yield* spawnItemFx({
					id: "runtime:byproduct",
					itemId: "item:byproduct",
					location: {
						scope: "board",
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				});
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					itemId: "blueprint:output",
					x: 0,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:output",
				});
				const updated = yield* setItemQuantityFx({
					itemId: byproduct.id,
					quantity: 2,
					revision: byproduct.revision,
				}).pipe(Effect.either);
				return {
					updated,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(Either.isLeft(result.updated)).toBe(true);
		if (Either.isLeft(result.updated)) {
			expect(result.updated.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "item:max-count",
			});
		}
		expect(result.runtime.items.find((item) => item.id === "runtime:byproduct")?.quantity).toBe(
			1,
		);
	});

	it("keeps a queued FIFO head blocked when maxCount is consumed before dispatch", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:producer",
					itemId: "producer:limited",
					location: {
						scope: "board",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:limited",
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:limited",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.filter((item) => item.item.id === "item:queue-product")).toHaveLength(
			1,
		);
		expect(runtime.jobs).toEqual([]);
		expect(runtime.jobQueue).toEqual([
			expect.objectContaining({
				ownerItemId: "runtime:producer",
				lineId: "line:producer:limited",
			}),
		]);
	});

	it("rejects a job when any quantity in its random range can exceed maxCount", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:range",
					itemId: "blueprint:range",
					x: 0,
					y: 0,
				});
				const started = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:range",
				}).pipe(Effect.either);
				return {
					started,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(Either.isLeft(result.started)).toBe(true);
		if (Either.isLeft(result.started)) {
			expect(result.started.left).toMatchObject({
				_tag: "JobOutputMaxCountError",
				itemId: "item:limited",
				reservedQuantity: 5,
				maxCount: 4,
			});
		}
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items.some((item) => item.item.id === "blueprint:range")).toBe(true);
	});

	it("round-trips an active blueprint job through persisted state", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					itemId: "blueprint:plain",
					x: 0,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:plain",
				});
				const runtime = yield* readRuntimeFx();
				const state = yield* fromRuntimeFx({
					runtime,
				});
				return {
					runtime,
					state,
					restored: yield* fromStateFx({
						state,
					}),
				};
			}),
		);

		expect(result.restored.jobs).toEqual(result.runtime.jobs);
		expect(result.restored.jobQueue).toEqual(result.runtime.jobQueue);
		expect(result.restored.items.map((item) => item.location)).toEqual(
			result.runtime.items.map((item) => item.location),
		);
		expect(result.state.jobs).toHaveLength(1);
	});

	it("discards queued work bound to the blueprint identity when replacement completes", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					itemId: "blueprint:plain",
					x: 0,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:plain",
				});
				const started = yield* readRuntimeFx();
				const job = started.jobs[0];
				return yield* completeJobRuntimeFx({
					jobId: job.id,
					runtime: {
						...started,
						jobs: [
							{
								...job,
								remainingMs: 0,
							},
						],
						jobQueue: [
							{
								id: "request:stale",
								ownerItemId: owner.id,
								lineId: "line:blueprint:plain",
								revision: "revision:stale",
							},
						],
					},
				});
			}),
		);

		expect(runtime.jobQueue).toEqual([]);
		expect(runtime.items.some((item) => item.id === "runtime:blueprint")).toBe(false);
	});
});
