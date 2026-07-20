import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { lineRunRuntime, lineRunTestConfig } from "~test/line/fx/run/support/lineRunTestRuntime";

const readLines = (runtime: RuntimeSchema.Type, itemId = "runtime:workshop") =>
	Effect.runSync(
		readItemDetailLinesFx({
			itemId,
			runtime,
		}),
	);

describe("readItemDetailLinesFx", () => {
	it("uses canonical visibility, enable, input readiness, and effective runtime", () => {
		const blocked = readLines(
			lineRunRuntime({
				permit: true,
				booster: true,
				water: [
					2,
				],
			}),
		);
		expect(blocked.kind).toBe("available");
		if (blocked.kind !== "available") throw new Error("Expected available lines.");
		expect(blocked.line).toHaveLength(1);
		expect(blocked.line[0]).toMatchObject({
			lineId: "line:workshop:build",
			baseRuntimeMs: 1_000,
			effectiveRuntimeMs: 500,
			availability: {
				kind: "blocked",
				reason: "inputs",
			},
			input: [
				{
					kind: "materials",
					storedQuantity: 2,
					required: {
						min: 3,
						max: 3,
					},
					missingQuantity: 1,
					availableCapacity: 3,
					ready: false,
				},
			],
		});

		const ready = readLines(
			lineRunRuntime({
				permit: true,
				booster: true,
				water: [
					2,
					1,
				],
			}),
		);
		expect(ready.kind).toBe("available");
		if (ready.kind !== "available") throw new Error("Expected available lines.");
		expect(ready.line[0]?.availability).toEqual({
			kind: "ready",
		});
	});

	it("keeps an active hidden-by-default line inspectable while its owner is stored", () => {
		const runtime = lineRunRuntime({
			permit: false,
		});
		const stored = {
			...runtime,
			items: runtime.items.map((item) =>
				item.id === "runtime:workshop"
					? {
							...item,
							location: {
								scope: "toolbar" as const,
								position: {
									x: 0,
									y: 0,
								},
							},
						}
					: item,
			),
			jobs: [
				{
					id: "job:workshop",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					durationMs: 1_000,
					remainingMs: 400,
				},
			],
		} satisfies RuntimeSchema.Type;
		const lines = readLines(stored);
		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line).toMatchObject([
			{
				availability: {
					kind: "blocked",
					reason: "stored",
				},
				activeJob: {
					remainingMs: 400,
				},
			},
		]);
	});

	it("groups duplicate drops without flattening guaranteed and chance rolls", () => {
		const config = GameConfigSchema.parse({
			version: "1.0",
			resources: {
				hero: "hero",
			},
			meta: {
				id: "game:tile-lines-output",
				title: "Tile lines output",
				board: {
					width: 1,
					height: 1,
				},
				inventory: {
					width: 1,
					height: 1,
				},
			},
			start: {
				currentSpace: 0,
				board: [
					{
						itemId: "workshop",
						space: 0,
						x: 0,
						y: 0,
					},
				],
			},
			categories: {},
			items: {
				workshop: {
					id: "workshop",
					type: "producer",
					title: "Workshop",
					description: "Produces grouped output.",
					asset: {
						source: [
							"asset:workshop",
						],
					},
					tags: [],
					categoryId: "building",
					scope: "board",
					maxStackSize: 1,
					maxQueueSize: 1,
					lines: [
						{
							id: "line:workshop:output",
							title: "Output",
							description: "Produces output.",
							show: true,
							enable: true,
							runtimeMs: 1_000,
							input: [
								{
									type: "simple",
								},
							],
							rules: [],
							output: {
								set: [
									{
										roll: [
											{
												type: "guaranteed",
												drop: [
													{
														itemId: "wood",
														quantity: {
															type: "value",
															value: 2,
														},
														rules: [],
													},
													{
														itemId: "wood",
														quantity: {
															type: "range",
															min: 1,
															max: 3,
														},
														rules: [],
													},
												],
											},
											{
												type: "chance",
												chance: 0.25,
												drop: [
													{
														itemId: "gem",
														quantity: {
															type: "value",
															value: 1,
														},
														rules: [],
													},
												],
											},
										],
									},
								],
							},
						},
					],
				},
				wood: {
					id: "wood",
					type: "simple",
					title: "Wood",
					description: "Wood.",
					asset: {
						source: [
							"asset:wood",
						],
					},
					tags: [],
					categoryId: "resource",
					scope: "any",
					maxStackSize: 10,
				},
				gem: {
					id: "gem",
					type: "simple",
					title: "Gem",
					description: "Gem.",
					asset: {
						source: [
							"asset:gem",
						],
					},
					tags: [],
					categoryId: "resource",
					scope: "any",
					maxStackSize: 10,
				},
			},
		});
		const runtime = Effect.runSync(
			startFx().pipe(
				useGameFx({
					config,
				}),
			),
		);
		const ownerId = runtime.items[0]?.id;
		if (ownerId === undefined) throw new Error("Missing output owner.");
		const lines = readLines(runtime, ownerId);
		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]?.output).toEqual([
			{
				weight: 1,
				roll: [
					{
						kind: "guaranteed",
						item: [
							{
								itemId: "wood",
								quantity: {
									min: 3,
									max: 5,
								},
							},
						],
					},
					{
						kind: "chance",
						chance: 0.25,
						item: [
							{
								itemId: "gem",
								quantity: {
									min: 1,
									max: 1,
								},
							},
						],
					},
				],
			},
		]);
	});

	it("returns unavailable for stale and non-line identities", () => {
		const runtime = lineRunRuntime({});
		expect(readLines(runtime, "runtime:missing")).toEqual({
			kind: "unavailable",
		});
		const water = runtime.items.find(
			(item) => item.item.id === lineRunTestConfig.items.water.id,
		);
		if (water !== undefined) {
			expect(readLines(runtime, water.id)).toEqual({
				kind: "unavailable",
			});
		}
	});
});
