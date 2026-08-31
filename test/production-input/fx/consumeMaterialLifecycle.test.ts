import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { setDefaultLineFx } from "~/production-line/fx/setDefaultLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";

const base = (id: string) => ({
	uid: id,
	id,
	title: id,
	description: id,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	scope: "board" as const,
	maxStackSize: 1,
});

const materialInput = (itemId: string) => ({
	type: "materials" as const,
	selector: {
		type: "item" as const,
		itemId,
	},
	quantity: {
		min: 1,
		max: 1,
	},
	capacity: 0,
	mode: "consume" as const,
});

const line = (id: string, itemId: string, outputItemId?: string) => ({
	id,
	title: id,
	description: id,
	runtimeMs: 200,
	input: [
		materialInput(itemId),
	] as const,
	output:
		outputItemId === undefined
			? undefined
			: {
					set: [
						{
							roll: [
								{
									type: "guaranteed" as const,
									drop: [
										{
											itemId: outputItemId,
											quantity: {
												min: 1,
												max: 1,
											},
											placement: "drop" as const,
											rules: [],
										},
									],
								},
							],
						},
					],
				},
	rules: [],
});

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:consume-material-lifecycle",
		title: "Consume material lifecycle",
		board: {
			width: 6,
			height: 2,
		},
		inventory: {
			width: 2,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		"producer:converter": {
			...base("producer:converter"),
			type: "producer",
			maxQueueSize: 1,
			lines: [
				line("line:converter:run", "producer:inner", "item:product"),
				line("line:converter:recycle", "item:product", "item:product"),
			],
		},
		"producer:inner": {
			...base("producer:inner"),
			type: "producer",
			maxQueueSize: 1,
			lines: [
				line("line:inner:load", "producer:middle"),
			],
		},
		"producer:middle": {
			...base("producer:middle"),
			type: "producer",
			maxQueueSize: 1,
			lines: [
				line("line:middle:load", "item:payload"),
			],
		},
		"item:payload": {
			...base("item:payload"),
			type: "simple",
		},
		"item:product": {
			...base("item:product"),
			type: "simple",
			maxCount: 1,
		},
	},
});

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const prepareNestedConsumeFx = Effect.fn("prepareNestedConsumeFx")(function* () {
	const converter = yield* spawnItemFx({
		id: "runtime:converter",
		itemId: "producer:converter",
		location: board(0),
		quantity: 1,
	});
	const inner = yield* spawnItemFx({
		id: "runtime:inner",
		itemId: "producer:inner",
		location: board(1),
		quantity: 1,
	});
	const middle = yield* spawnItemFx({
		id: "runtime:middle",
		itemId: "producer:middle",
		location: board(2),
		quantity: 1,
	});
	const payload = yield* spawnItemFx({
		id: "runtime:payload",
		itemId: "item:payload",
		location: board(3),
		quantity: 1,
	});

	yield* setDefaultLineFx({
		ownerItemId: inner.id,
		lineId: "line:inner:load",
	});
	yield* storeInputMaterialFx({
		ownerItemId: middle.id,
		lineId: "line:middle:load",
		inputIndex: 0,
		sourceItemId: payload.id,
		sourceItemRevision: payload.revision,
		quantity: 1,
	});
	yield* storeInputMaterialFx({
		ownerItemId: inner.id,
		lineId: "line:inner:load",
		inputIndex: 0,
		sourceItemId: middle.id,
		sourceItemRevision: middle.revision,
		quantity: 1,
	});
	yield* storeInputMaterialFx({
		ownerItemId: converter.id,
		lineId: "line:converter:run",
		inputIndex: 0,
		sourceItemId: inner.id,
		sourceItemRevision: inner.revision,
		quantity: 1,
	});

	return converter;
});

describe("consume material lifecycle", () => {
	it("keeps the root until completion but destroys its entire owned subtree at start", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const converter = yield* prepareNestedConsumeFx();
				const stored = yield* readRuntimeFx();
				const started = yield* startLineFx({
					ownerItemId: converter.id,
					lineId: "line:converter:run",
				});
				if (started.type !== "started") {
					return yield* Effect.die(new Error("Expected the converter job to start."));
				}
				const running = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const completed = yield* readRuntimeFx();

				return {
					completed,
					jobId: started.job.id,
					running,
					stored,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.stored.items.map((item) => item.id)).toEqual(
			expect.arrayContaining([
				"runtime:inner",
				"runtime:middle",
				"runtime:payload",
			]),
		);
		expect(result.running.items.find((item) => item.id === "runtime:inner")?.location).toEqual({
			scope: "job",
			jobId: result.jobId,
		});
		expect(result.running.items.some((item) => item.id === "runtime:middle")).toBe(false);
		expect(result.running.items.some((item) => item.id === "runtime:payload")).toBe(false);
		expect(result.running.defaultLineByOwnerItemId?.["runtime:inner"]).toBeUndefined();
		expect(result.completed.items.some((item) => item.id === "runtime:inner")).toBe(false);
		expect(
			result.completed.items.filter((item) => item.item.id === "item:product"),
		).toHaveLength(1);
	});

	it("rolls back destructive subtree consume when a later start invariant fails", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const converter = yield* prepareNestedConsumeFx();
				yield* spawnItemFx({
					id: "runtime:product:blocker",
					itemId: "item:product",
					location: board(4),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					startLineFx({
						ownerItemId: converter.id,
						lineId: "line:converter:run",
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.attempt).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "OutputCapacityError",
					itemId: "item:product",
				}),
			),
		);
		expect(result.after).toEqual(result.before);
		expect(result.after.items.map((item) => item.id)).toEqual(
			expect.arrayContaining([
				"runtime:inner",
				"runtime:middle",
				"runtime:payload",
			]),
		);
	});

	it("reserves only the net maxCount increase of consumed job material", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const converter = yield* spawnItemFx({
					id: "runtime:converter",
					itemId: "producer:converter",
					location: board(0),
					quantity: 1,
				});
				const product = yield* spawnItemFx({
					id: "runtime:product",
					itemId: "item:product",
					location: board(1),
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: converter.id,
					lineId: "line:converter:recycle",
					inputIndex: 0,
					sourceItemId: product.id,
					sourceItemRevision: product.revision,
					quantity: 1,
				});
				const started = yield* startLineFx({
					ownerItemId: converter.id,
					lineId: "line:converter:recycle",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					product,
					runtime: yield* readRuntimeFx(),
					started,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.started.type).toBe("started");
		const products = result.runtime.items.filter((item) => item.item.id === "item:product");
		expect(products).toHaveLength(1);
		expect(products[0]?.id).not.toBe(result.product.id);
	});
});
