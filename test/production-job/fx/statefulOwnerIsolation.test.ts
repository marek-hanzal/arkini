import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/createTestGameSession";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { useGameFx } from "~test/support/useGameFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";

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
	},
	start: {
		currentSpace: 0,
	},
	items: {
		producer: {
			maxQueueSize: 1,

			uid: "producer",
			id: "producer",
			title: "Producer",
			description: "Producer",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:producer",
				],
			},
			maxStackSize: 10,

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
								rules: [],
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
			maxQueueSize: 1,
			lines: [],

			uid: "limited",
			id: "limited",
			title: "Limited",
			description: "Limited",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:limited",
				],
			},
			maxStackSize: 10,
		},
		blocker: {
			maxQueueSize: 1,
			lines: [],

			uid: "blocker",
			id: "blocker",
			title: "Blocker",
			description: "Blocker",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:blocker",
				],
			},
			maxStackSize: 10,
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
});

it("replans against the latest capacity and publishes no transient start event", async () => {
	const session = await createTestGameSession({
		config,
		tickIntervalMs: 60_000,
	});
	const eventBatches: unknown[] = [];

	try {
		await session.runFn(spawnOwnerFx(2));
		const observed = session.getSnapshotFn();
		expect(
			observed.items.some(
				(item) => item.location.scope === "board" && item.location.position.x === 1,
			),
		).toBe(false);

		await session.runFn(
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
		const before = session.getSnapshotFn();
		const unsubscribe = session.subscribeEventsFn((batch) => {
			eventBatches.push(batch);
		});

		try {
			await expect(
				session.runFn(
					startLineFx({
						ownerItemId: "runtime:producer",
						lineId: "line:producer",
					}),
				),
			).rejects.toMatchObject({
				_tag: "PlacementUnavailableError",
			});
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(session.getSnapshotFn()).toEqual(before);
			expect(eventBatches).toEqual([]);
		} finally {
			unsubscribe();
		}
	} finally {
		await Effect.runPromise(session.disposeFx);
	}
});
