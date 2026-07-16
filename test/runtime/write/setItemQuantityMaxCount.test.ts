import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { setItemQuantityFx } from "~/engine/runtime/write/setItemQuantityFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createGameSession } from "~/bridge/game/createGameSession";

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:set-item-quantity-max-count",
		title: "Set item quantity maxCount",
		board: {
			width: 4,
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
	categories: {},
	items: {
		limited: {
			id: "limited",
			title: "Limited",
			description: "Limited",
			asset: {
				source: [
					"asset:limited",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 10,
			maxCount: 3,
			type: "simple",
		},
		producer: {
			id: "producer",
			title: "Producer",
			description: "Producer",
			asset: {
				source: [
					"asset:producer",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 1,
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
			],
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

const spawnLimitedFx = ({ id, quantity, x }: { id: string; quantity: number; x: number }) =>
	spawnItemFx({
		id,
		itemId: "limited",
		location: board(x),
		quantity,
	});

const run = <Result, Error, Requirements>(effect: Effect.Effect<Result, Error, Requirements>) => {
	return Effect.runSync(
		effect.pipe(
			useGameFx({
				config,
			}),
		) as Effect.Effect<Result, Error, never>,
	);
};

describe("setItemQuantityFx maxCount replacement", () => {
	it("supports increase, same-quantity revision and decrease at maxCount", () => {
		const result = run(
			Effect.gen(function* () {
				const initial = yield* spawnLimitedFx({
					id: "runtime:limited",
					quantity: 1,
					x: 0,
				});
				const increased = yield* setItemQuantityFx({
					itemId: initial.id,
					quantity: 3,
					revision: initial.revision,
				});
				const revised = yield* setItemQuantityFx({
					itemId: increased.id,
					quantity: 3,
					revision: increased.revision,
				});
				const decreased = yield* setItemQuantityFx({
					itemId: revised.id,
					quantity: 1,
					revision: revised.revision,
				});

				return {
					decreased,
					increased,
					initial,
					revised,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.increased.quantity).toBe(3);
		expect(result.revised.quantity).toBe(3);
		expect(result.revised.revision).not.toBe(result.increased.revision);
		expect(result.decreased.quantity).toBe(1);
		expect(result.runtime.items).toEqual([
			result.decreased,
		]);
	});

	it("counts other live quantities while replacing only the target stack", async () => {
		const session = await createGameSession({
			config,
			tickIntervalMs: 60_000,
		});
		const eventBatches: unknown[] = [];

		try {
			const target = await session.run(
				spawnLimitedFx({
					id: "runtime:target",
					quantity: 1,
					x: 0,
				}),
			);
			await session.run(
				spawnLimitedFx({
					id: "runtime:other",
					quantity: 1,
					x: 1,
				}),
			);
			const updated = await session.run(
				setItemQuantityFx({
					itemId: target.id,
					quantity: 2,
					revision: target.revision,
				}),
			);
			const beforeFailure = session.getSnapshot();
			const unsubscribe = session.subscribeEvents((batch) => {
				eventBatches.push(batch);
			});
			try {
				await expect(
					session.run(
						setItemQuantityFx({
							itemId: updated.id,
							quantity: 3,
							revision: updated.revision,
						}),
					),
				).rejects.toMatchObject({
					_tag: "PlacementUnavailableError",
					itemId: "limited",
					quantity: 3,
					reason: "item:max-count",
					remainingQuantity: 1,
				});
				expect(session.getSnapshot()).toEqual(beforeFailure);
				expect(eventBatches).toEqual([]);
			} finally {
				unsubscribe();
			}
		} finally {
			await session.dispose();
		}
	});

	it("continues to count active job output reservations", () => {
		const result = run(
			Effect.gen(function* () {
				const target = yield* spawnLimitedFx({
					id: "runtime:target",
					quantity: 1,
					x: 0,
				});
				const producer = yield* spawnItemFx({
					id: "runtime:producer",
					itemId: "producer",
					location: board(1),
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: producer.id,
					lineId: "line:producer",
				});
				const updated = yield* setItemQuantityFx({
					itemId: target.id,
					quantity: 2,
					revision: target.revision,
				});
				const rejected = yield* setItemQuantityFx({
					itemId: updated.id,
					quantity: 3,
					revision: updated.revision,
				}).pipe(Effect.either);

				return {
					rejected,
					runtime: yield* readRuntimeFx(),
					updated,
				};
			}),
		);

		expect(result.updated.quantity).toBe(2);
		expect(Either.isLeft(result.rejected)).toBe(true);
		if (Either.isLeft(result.rejected)) {
			expect(result.rejected.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "limited",
				quantity: 3,
				reason: "item:max-count",
				remainingQuantity: 1,
			});
		}
		expect(result.runtime.items.find((item) => item.id === result.updated.id)).toEqual(
			result.updated,
		);
		expect(result.runtime.jobs).toHaveLength(1);
	});
});
