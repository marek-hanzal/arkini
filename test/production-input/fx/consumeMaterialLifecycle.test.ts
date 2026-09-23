import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { setLineSelectionFx } from "~/production-line/fx/setLineSelectionFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";

const base = (id: string) => ({
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

const materialInput = (itemId: string) => ({
	type: "materials" as const,
	query: {
		distance: "far" as const,
		selector: {
			type: "item" as const,
			itemUid: itemId,
		},
	},
	quantity: {
		min: 1,
		max: 1,
	},
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
	outcome:
		outputItemId === undefined
			? undefined
			: {
					set: [
						{
							rules: [],
							roll: [
								{
									type: "guaranteed" as const,
									outcome: [
										{
											type: "item" as const,
											itemUid: outputItemId,
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
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		"producer:converter": {
			...base("producer:converter"),

			maxQueueSize: 1,
			lines: [
				line("line:converter:run", "producer:inner", "item:product"),
				line("line:converter:recycle", "item:product", "item:product"),
			],
		},
		"producer:inner": {
			...base("producer:inner"),

			maxQueueSize: 1,
			lines: [
				line("line:inner:load", "producer:middle"),
			],
		},
		"producer:middle": {
			...base("producer:middle"),

			maxQueueSize: 1,
			lines: [
				line("line:middle:load", "item:payload"),
			],
		},
		"item:payload": {
			maxQueueSize: 1,
			lines: [],

			...base("item:payload"),
		},
		"item:product": {
			maxQueueSize: 1,
			lines: [],

			...base("item:product"),
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
		itemUid: "producer:converter",
		location: board(0),
	});
	const inner = yield* spawnItemFx({
		id: "runtime:inner",
		itemUid: "producer:inner",
		location: board(1),
	});
	const middle = yield* spawnItemFx({
		id: "runtime:middle",
		itemUid: "producer:middle",
		location: board(2),
	});
	const payload = yield* spawnItemFx({
		id: "runtime:payload",
		itemUid: "item:payload",
		location: board(3),
	});

	yield* setLineSelectionFx({
		selection: "default",
		ownerItemId: inner.id,
		lineId: "line:inner:load",
	});
	yield* bufferInputMaterialForTestFx({
		ownerItemId: middle.id,
		lineId: "line:middle:load",
		inputIndex: 0,
		sourceItemId: payload.id,
		sourceItemRevision: payload.revision,
	});
	yield* bufferInputMaterialForTestFx({
		ownerItemId: inner.id,
		lineId: "line:inner:load",
		inputIndex: 0,
		sourceItemId: middle.id,
		sourceItemRevision: middle.revision,
	});
	yield* bufferInputMaterialForTestFx({
		ownerItemId: converter.id,
		lineId: "line:converter:run",
		inputIndex: 0,
		sourceItemId: inner.id,
		sourceItemRevision: inner.revision,
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
			inputIndex: 0,
		});
		expect(result.running.items.some((item) => item.id === "runtime:middle")).toBe(false);
		expect(result.running.items.some((item) => item.id === "runtime:payload")).toBe(false);
		expect(result.running.defaultLineByOwnerItemId?.["runtime:inner"]).toBeUndefined();
		expect(result.completed.items.some((item) => item.id === "runtime:inner")).toBe(false);
		expect(
			result.completed.items.filter((item) => item.item.uid === "item:product"),
		).toHaveLength(1);
	});
});
