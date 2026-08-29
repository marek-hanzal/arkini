import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/game/createTestGameSession";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { useGameFx } from "~test/support/game/useGameFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:stateful-owner-isolation",
		title: "Stateful owner isolation",
		board: {
			width: 2,
			height: 1,
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
		producer: {
			uid: "producer",
			id: "producer",
			title: "Producer",
			description: "Producer",
			asset: {
				default: [
					"asset:producer",
				],
			},
			scope: "any",
			maxStackSize: 10,
			type: "producer",
			lines: [
				{
					id: "line:producer",
					title: "Produce",
					description: "Produce",
					runtimeMs: 1_000,
					input: [
						{
							type: "simple",
						},
					],
					rules: [],
				},
				{
					id: "line:producer:limited",
					title: "Limited production",
					description: "Produce a bounded random quantity.",
					runtimeMs: 1_000,
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
												itemId: "limited",
												quantity: {
													min: 1,
													max: 5,
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
			],
		},
		limited: {
			uid: "limited",
			id: "limited",
			title: "Limited",
			description: "Limited",
			asset: {
				default: [
					"asset:limited",
				],
			},
			scope: "board",
			maxStackSize: 10,
			maxCount: 4,
			type: "simple",
		},
		blocker: {
			uid: "blocker",
			id: "blocker",
			title: "Blocker",
			description: "Blocker",
			asset: {
				default: [
					"asset:blocker",
				],
			},
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
	},
});

const ownerLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const spawnOwnerFx = (quantity: number) => {
	return spawnItemFx({
		id: "runtime:producer",
		itemId: "producer",
		location: ownerLocation,
		quantity,
	});
};

describe("line start state owner isolation", () => {
	it("isolates one generic producer instance before its job owns the identity", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx(3);
				yield* startLineFx({
					ownerItemId: "runtime:producer",
					lineId: "line:producer",
				});

				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				ownerItemId: "runtime:producer",
				lineId: "line:producer",
			}),
		]);
		expect(runtime.items.find((item) => item.id === "runtime:producer")).toMatchObject({
			location: ownerLocation,
			quantity: 1,
		});
		expect(
			runtime.items.find(
				(item) => item.item.id === "producer" && item.id !== "runtime:producer",
			),
		).toMatchObject({
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
			quantity: 2,
		});
	});

	it("rolls back the job and split when no remainder placement is available", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx(2);
				yield* spawnItemFx({
					id: "runtime:blocker:board",
					itemId: "blocker",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:blocker:inventory",
					itemId: "blocker",
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
				const started = yield* Effect.result(
					startLineFx({
						ownerItemId: "runtime:producer",
						lineId: "line:producer",
					}),
				);

				return {
					after: yield* readRuntimeFx(),
					before,
					started,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Result.isFailure(result.started)).toBe(true);
		if (Result.isFailure(result.started)) {
			expect(result.started.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "producer",
				reason: "inventory:full",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("replans against the latest capacity and publishes no transient start event", async () => {
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 60_000,
		});
		const eventBatches: unknown[] = [];

		try {
			await session.run(spawnOwnerFx(2));
			await session.run(
				spawnItemFx({
					id: "runtime:blocker:inventory",
					itemId: "blocker",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			const observed = session.getSnapshot();
			expect(
				observed.items.some(
					(item) => item.location.scope === "board" && item.location.position.x === 1,
				),
			).toBe(false);

			await session.run(
				spawnItemFx({
					id: "runtime:blocker:board",
					itemId: "blocker",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			const before = session.getSnapshot();
			const unsubscribe = session.subscribeEvents((batch) => {
				eventBatches.push(batch);
			});

			try {
				await expect(
					session.run(
						startLineFx({
							ownerItemId: "runtime:producer",
							lineId: "line:producer",
						}),
					),
				).rejects.toMatchObject({
					_tag: "PlacementUnavailableError",
				});
				await new Promise((resolve) => setTimeout(resolve, 20));
				expect(session.getSnapshot()).toEqual(before);
				expect(eventBatches).toEqual([]);
			} finally {
				unsubscribe();
			}
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("applies worst-case maxCount reservation to a generic producer line", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx(1);
				const started = yield* Effect.result(
					startLineFx({
						ownerItemId: "runtime:producer",
						lineId: "line:producer:limited",
					}),
				);

				return {
					runtime: yield* readRuntimeFx(),
					started,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Result.isFailure(result.started)).toBe(true);
		if (Result.isFailure(result.started)) {
			expect(result.started.failure).toMatchObject({
				_tag: "OutputCapacityError",
				itemId: "limited",
				reservedQuantity: 5,
				maxCount: 4,
			});
		}
		expect(result.runtime.jobs).toEqual([]);
	});
});
