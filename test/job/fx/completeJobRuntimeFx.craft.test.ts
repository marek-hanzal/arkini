import { Effect, Either, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { attemptJobCompletionFx } from "~/v1/job/fx/attemptJobCompletionFx";
import { completeJobRuntimeFx } from "~/v1/job/fx/completeJobRuntimeFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";

const craftCompletionConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:craft-completion",
		title: "Craft completion",
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
		"craft:drop": {
			id: "craft:drop",
			type: "craft",
			afterCompletion: "remove",
			title: "Drop craft",
			description: "Consumes itself and emits one ordinary output.",
			asset: {
				source: [
					"asset:craft-drop",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 3,
			line: {
				id: "line:craft:drop",
				title: "Complete",
				description: "Complete the drop craft.",
				runtimeMs: 200,
				input: [
					{
						type: "simple",
					},
				],
				output: {
					set: [
						{
							roll: [
								{
									type: "guaranteed",
									drop: [
										{
											itemId: "item:product",
											quantity: {
												type: "value",
												value: 1,
											},
											placement: "drop",
											rules: [],
										},
									],
								},
							],
						},
					],
				},
				rules: [],
			},
		},
		"craft:replace": {
			id: "craft:replace",
			type: "craft",
			afterCompletion: "remove",
			title: "Replace craft",
			description: "Replaces itself and emits a bonus output.",
			asset: {
				source: [
					"asset:craft-replace",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 3,
			line: {
				id: "line:craft:replace",
				title: "Complete",
				description: "Complete the replacement craft.",
				runtimeMs: 200,
				input: [
					{
						type: "simple",
					},
				],
				output: {
					set: [
						{
							roll: [
								{
									type: "guaranteed",
									drop: [
										{
											itemId: "item:bonus",
											quantity: {
												type: "value",
												value: 1,
											},
											placement: "drop",
											rules: [],
										},
										{
											itemId: "item:replacement",
											quantity: {
												type: "value",
												value: 1,
											},
											placement: "replace",
											rules: [],
										},
									],
								},
							],
						},
					],
				},
				rules: [],
			},
		},
		"craft:reserve": {
			id: "craft:reserve",
			type: "craft",
			afterCompletion: "remove",
			title: "Reserve craft",
			description: "Returns its reserved tool after output placement.",
			asset: {
				source: [
					"asset:craft-reserve",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 1,
			line: {
				id: "line:craft:reserve",
				title: "Complete",
				description: "Complete with a reusable tool.",
				runtimeMs: 200,
				input: [
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "item:tool",
						},
						mode: "reserve",
						quantity: {
							type: "value",
							value: 1,
						},
					},
				],
				output: {
					set: [
						{
							roll: [
								{
									type: "guaranteed",
									drop: [
										{
											itemId: "item:product",
											quantity: {
												type: "value",
												value: 1,
											},
											placement: "drop",
											rules: [],
										},
									],
								},
							],
						},
					],
				},
				rules: [],
			},
		},
		"craft:sink": {
			id: "craft:sink",
			type: "craft",
			afterCompletion: "remove",
			title: "Sink craft",
			description: "Consumes itself without output.",
			asset: {
				source: [
					"asset:craft-sink",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 1,
			line: {
				id: "line:craft:sink",
				title: "Remove",
				description: "Remove the craft target.",
				runtimeMs: 200,
				input: [
					{
						type: "simple",
					},
				],
				rules: [],
			},
		},
		"craft:random": {
			id: "craft:random",
			type: "craft",
			afterCompletion: "remove",
			title: "Random craft",
			description: "Produces one deterministic two-item alternative.",
			asset: {
				source: [
					"asset:craft-random",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 1,
			line: {
				id: "line:craft:random",
				title: "Complete",
				description: "Complete the random craft.",
				runtimeMs: 200,
				input: [
					{
						type: "simple",
					},
				],
				output: {
					set: [
						{
							weight: 1,
							roll: [
								{
									type: "guaranteed",
									drop: [
										{
											itemId: "item:random-a",
											quantity: {
												type: "value",
												value: 2,
											},
											placement: "random",
											rules: [],
										},
									],
								},
							],
						},
						{
							weight: 1,
							roll: [
								{
									type: "guaranteed",
									drop: [
										{
											itemId: "item:random-b",
											quantity: {
												type: "value",
												value: 2,
											},
											placement: "random",
											rules: [],
										},
									],
								},
							],
						},
					],
				},
				rules: [],
			},
		},
		"item:product": {
			id: "item:product",
			type: "simple",
			title: "Product",
			description: "Ordinary craft output.",
			asset: {
				source: [
					"asset:product",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 1,
		},
		"item:replacement": {
			id: "item:replacement",
			type: "simple",
			title: "Replacement",
			description: "Craft replacement output.",
			asset: {
				source: [
					"asset:replacement",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 1,
		},
		"item:bonus": {
			id: "item:bonus",
			type: "simple",
			title: "Bonus",
			description: "Additional ordinary output.",
			asset: {
				source: [
					"asset:bonus",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 1,
		},
		"item:tool": {
			id: "item:tool",
			type: "simple",
			title: "Tool",
			description: "Reusable craft input.",
			asset: {
				source: [
					"asset:tool",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 1,
		},
		"item:blocker": {
			id: "item:blocker",
			type: "simple",
			title: "Blocker",
			description: "Occupies completion capacity.",
			asset: {
				source: [
					"asset:blocker",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 1,
		},
		"item:random-a": {
			id: "item:random-a",
			type: "simple",
			title: "Random A",
			description: "First deterministic alternative.",
			asset: {
				source: [
					"asset:random-a",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 1,
		},
		"item:random-b": {
			id: "item:random-b",
			type: "simple",
			title: "Random B",
			description: "Second deterministic alternative.",
			asset: {
				source: [
					"asset:random-b",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "any",
			maxStackSize: 1,
		},
	},
});

const spawnCraftFx = Effect.fn("spawnCraftFx")(function* ({
	itemId,
	quantity = 1,
}: {
	itemId: "craft:drop" | "craft:replace" | "craft:reserve" | "craft:sink" | "craft:random";
	quantity?: number;
}) {
	return yield* spawnItemFx({
		id: `runtime:${itemId}`,
		itemId,
		location: {
			scope: "board",
			position: {
				x: 0,
				y: 0,
			},
		},
		quantity,
	});
});

const projectRandomCraftOutputFx = Effect.fn("projectRandomCraftOutputFx")(function* ({
	runtime,
}: {
	runtime: RuntimeSchema.Type;
}) {
	return runtime.items
		.filter((item) => item.item.id === "item:random-a" || item.item.id === "item:random-b")
		.map((item) => ({
			itemId: item.item.id,
			location: item.location,
			quantity: item.quantity,
		}))
		.sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
});

describe("craft job completion", () => {
	it("consumes the craft, places ordinary output on its freed origin, then returns reservations", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:reserve",
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
					lineId: "line:craft:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:reserve",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: craftCompletionConfig,
				}),
			),
		);

		expect(runtime.jobs).toEqual([]);
		expect(runtime.items.some((item) => item.item.id === "craft:reserve")).toBe(false);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:product",
					}),
					location: {
						scope: "board",
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:tool",
					}),
					location: {
						scope: "board",
						position: {
							x: 1,
							y: 0,
						},
					},
				}),
			]),
		);
		expect(runtime.items.some((item) => item.location.scope === "job")).toBe(false);
	});

	it("replaces the craft first and places additional output around the same origin", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:replace",
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:replace",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: craftCompletionConfig,
				}),
			),
		);

		expect(runtime.items.some((item) => item.item.id === "craft:replace")).toBe(false);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:replacement",
					}),
					location: {
						scope: "board",
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:bonus",
					}),
					location: {
						scope: "board",
						position: {
							x: 1,
							y: 0,
						},
					},
				}),
			]),
		);
	});

	it("splits a stacked craft before starting one isolated owner", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:drop",
					quantity: 3,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:drop",
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: craftCompletionConfig,
				}),
			),
		);

		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				ownerItemId: "runtime:craft:drop",
			}),
		]);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "runtime:craft:drop",
					quantity: 1,
					location: {
						scope: "board",
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "craft:drop",
					}),
					quantity: 2,
				}),
			]),
		);
		expect(runtime.items.filter((item) => item.item.id === "craft:drop")).toHaveLength(2);
	});

	it("rejects a stacked craft start atomically when its remainder cannot be placed", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:drop",
					quantity: 2,
				});
				let blockerIndex = 0;
				for (let y = 0; y < 2; y += 1) {
					for (let x = 0; x < 3; x += 1) {
						if (x === 0 && y === 0) continue;
						yield* spawnItemFx({
							id: `runtime:start-blocker:${blockerIndex}`,
							itemId: "item:blocker",
							location: {
								scope: "board",
								position: {
									x,
									y,
								},
							},
							quantity: 1,
						});
						blockerIndex += 1;
					}
				}
				yield* spawnItemFx({
					id: "runtime:start-inventory-blocker",
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
						lineId: "line:craft:drop",
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: craftCompletionConfig,
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "PlacementUnavailableError",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("starts another craft from the separated stack while the first craft is running", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:drop",
					quantity: 3,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:drop",
				});
				const afterFirst = yield* readRuntimeFx();
				const remainder = afterFirst.items.find(
					(item) => item.item.id === "craft:drop" && item.id !== owner.id,
				);
				if (remainder === undefined) throw new Error("Expected separated craft remainder.");
				yield* startLineFx({
					ownerItemId: remainder.id,
					lineId: "line:craft:drop",
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: craftCompletionConfig,
				}),
			),
		);

		expect(runtime.jobs).toHaveLength(2);
		const runningOwnerIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
		for (const ownerItemId of runningOwnerIds) {
			expect(runtime.items.find((item) => item.id === ownerItemId)?.quantity).toBe(1);
		}
		expect(
			runtime.items.find(
				(item) => item.item.id === "craft:drop" && !runningOwnerIds.has(item.id),
			),
		).toMatchObject({
			quantity: 1,
		});
	});

	it("replaces one isolated craft while its already separated remainder stays available", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:replace",
					quantity: 3,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:replace",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: craftCompletionConfig,
				}),
			),
		);

		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:replacement",
					}),
					location: {
						scope: "board",
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "craft:replace",
					}),
					quantity: 2,
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:bonus",
					}),
				}),
			]),
		);
		expect(
			runtime.items.find((item) => item.item.id === "craft:replace")?.location,
		).not.toEqual({
			scope: "board",
			position: {
				x: 0,
				y: 0,
			},
		});
	});

	it("supports a craft sink that consumes itself without output", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:sink",
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:sink",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: craftCompletionConfig,
				}),
			),
		);

		expect(runtime.items).toEqual([]);
		expect(runtime.jobs).toEqual([]);
	});

	it("keeps blocked craft completion unchanged and replays one deterministic output", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:random",
				});
				let blockerIndex = 0;
				for (let y = 0; y < 2; y += 1) {
					for (let x = 0; x < 3; x += 1) {
						if (x === 0 && y === 0) continue;
						yield* spawnItemFx({
							id: `runtime:blocker:${blockerIndex}`,
							itemId: "item:blocker",
							location: {
								scope: "board",
								position: {
									x,
									y,
								},
							},
							quantity: 1,
						});
						blockerIndex += 1;
					}
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
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:random",
				});
				const running = yield* readRuntimeFx();
				const liveJob = running.jobs[0];
				if (liveJob === undefined) throw new Error("Expected craft completion job.");
				const job = {
					...liveJob,
					id: "job:craft:deterministic",
					remainingMs: 0,
				} satisfies JobSchema.Type;
				const fullRuntime = {
					...running,
					jobs: [
						job,
					],
				} satisfies RuntimeSchema.Type;
				const freeRuntime = {
					...fullRuntime,
					items: fullRuntime.items.filter((item) => item.id !== "runtime:blocker:0"),
				} satisfies RuntimeSchema.Type;
				const blocked = yield* attemptJobCompletionFx({
					jobId: job.id,
					runtime: fullRuntime,
				}).pipe(
					Effect.withRandom(
						Random.fixed([
							0.01,
						]),
					),
				);
				const immediate = yield* completeJobRuntimeFx({
					jobId: job.id,
					runtime: freeRuntime,
				}).pipe(
					Effect.withRandom(
						Random.fixed([
							0.01,
						]),
					),
				);
				const retried = yield* completeJobRuntimeFx({
					jobId: job.id,
					runtime: freeRuntime,
				}).pipe(
					Effect.withRandom(
						Random.fixed([
							0.99,
						]),
					),
				);

				return {
					blocked,
					fullRuntime,
					immediate: yield* projectRandomCraftOutputFx({
						runtime: immediate,
					}),
					retried: yield* projectRandomCraftOutputFx({
						runtime: retried,
					}),
				};
			}).pipe(
				useGameFx({
					config: craftCompletionConfig,
				}),
			),
		);

		expect(result.blocked).toMatchObject({
			type: "blocked",
		});
		if (result.blocked.type === "blocked") {
			expect(result.blocked.runtime).toBe(result.fullRuntime);
			expect(
				result.blocked.runtime.items.some((item) => item.item.id === "craft:random"),
			).toBe(true);
			expect(result.blocked.runtime.jobs).toHaveLength(1);
		}
		expect(result.immediate).not.toEqual([]);
		expect(result.retried).toEqual(result.immediate);
	});

	it("round-trips an active craft job and its reservation through persisted state", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:reserve",
				});
				const tool = yield* spawnItemFx({
					id: "runtime:roundtrip-tool",
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
					lineId: "line:craft:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:reserve",
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
			}).pipe(
				useGameFx({
					config: craftCompletionConfig,
				}),
			),
		);

		expect(result.restored.jobs).toEqual(result.runtime.jobs);
		expect(result.restored.jobQueue).toEqual(result.runtime.jobQueue);
		expect(result.restored.items.map((item) => item.location)).toEqual(
			result.runtime.items.map((item) => item.location),
		);
		expect(result.state.items.some((item) => item.location.scope === "job")).toBe(true);
	});
});
