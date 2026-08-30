import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createTestGameSession } from "~test/support/game/createTestGameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";
import { storeInputMaterialFx } from "~/production-input/write/storeInputMaterialFx";
import { enqueueLineFx } from "~/production-job/write/enqueueLineFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { TickStepMs } from "~/game-tick/constant/TickStepMs";

const lineId = "line:forge:run";

const prepareOwnerFx = Effect.fn("prepareOwnerFx")(function* ({
	id,
	y,
}: {
	readonly id: string;
	readonly y: number;
}) {
	const owner = yield* spawnItemFx({
		id: `runtime:forge:${id}`,
		itemId: "forge",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y,
			},
		},
		quantity: 1,
	});
	const water = yield* spawnItemFx({
		id: `runtime:water:${id}`,
		itemId: "water",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 1,
				y,
			},
		},
		quantity: 3,
	});
	const tool = yield* spawnItemFx({
		id: `runtime:tool:${id}`,
		itemId: "tool",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 2,
				y,
			},
		},
		quantity: 1,
	});
	yield* storeInputMaterialFx({
		ownerItemId: owner.id,
		lineId,
		inputIndex: 0,
		sourceItemId: water.id,
		sourceItemRevision: water.revision,
		quantity: 3,
	});
	yield* storeInputMaterialFx({
		ownerItemId: owner.id,
		lineId,
		inputIndex: 1,
		sourceItemId: tool.id,
		sourceItemRevision: tool.revision,
		quantity: 1,
	});
	return owner;
});

describe("GameSession Instant gameplay admission", () => {
	it("admits independent owner jobs before one shared Tick settles them", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});

		try {
			await session.run(
				Effect.gen(function* () {
					yield* setInstantGameplayFx({
						enabled: true,
					});
					yield* setCheatEnabledFx({
						enabled: true,
					});
				}),
			);
			const first = await session.run(
				prepareOwnerFx({
					id: "first",
					y: 0,
				}),
			);
			const second = await session.run(
				prepareOwnerFx({
					id: "second",
					y: 1,
				}),
			);

			await Promise.all([
				session.run(
					startLineFx({
						ownerItemId: first.id,
						lineId,
					}),
				),
				session.run(
					startLineFx({
						ownerItemId: second.id,
						lineId,
					}),
				),
			]);

			expect(
				session
					.getSnapshot()
					.jobs.map(({ ownerItemId }) => ownerItemId)
					.sort(),
			).toEqual(
				[
					first.id,
					second.id,
				].sort(),
			);

			await session.run(
				runTickRuntimeByFx({
					elapsedMs: TickStepMs,
				}),
			);
			expect(session.getSnapshot().jobs).toEqual([]);
		} finally {
			await Effect.runPromise(session.disposeWithoutSaveFx);
		}
	});

	it("wakes five rapidly enqueued requests after later sources reach the head without presentation settlement", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(5),
			tickIntervalMs: 1,
		});
		const ownerItemId = "runtime:forge:queue-race";
		let unsubscribe: () => void = () => undefined;

		try {
			await session.run(
				Effect.gen(function* () {
					yield* setInstantGameplayFx({
						enabled: true,
					});
					yield* setCheatEnabledFx({
						enabled: true,
					});
					yield* spawnItemFx({
						id: ownerItemId,
						itemId: "forge",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 0,
								y: 0,
							},
						},
						quantity: 1,
					});
					yield* spawnItemFx({
						id: "runtime:water:partial",
						itemId: "water",
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
				}),
			);

			await Promise.all(
				Array.from(
					{
						length: 5,
					},
					() =>
						session.run(
							enqueueLineFx({
								ownerItemId,
								lineId,
							}),
						),
				),
			);
			expect(session.getSnapshot().jobs).toEqual([]);
			expect(session.getSnapshot().jobQueue).toHaveLength(5);
			let publishWokenRuntime:
				| ((runtime: ReturnType<typeof session.getSnapshot>) => void)
				| undefined;
			const wokenRuntime = new Promise<ReturnType<typeof session.getSnapshot>>((resolve) => {
				publishWokenRuntime = resolve;
			});
			unsubscribe = session.subscribeTransitions((transition) => {
				if (transition.runtime.jobQueue.length === 4) {
					publishWokenRuntime?.(transition.runtime);
				}
			});

			await session.run(
				Effect.gen(function* () {
					yield* spawnItemFx({
						id: "runtime:water:remainder",
						itemId: "water",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 2,
								y: 0,
							},
						},
						quantity: 1,
					});
					yield* spawnItemFx({
						id: "runtime:tool:late",
						itemId: "tool",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 3,
								y: 0,
							},
						},
						quantity: 1,
					});
				}),
			);

			const runtime = await wokenRuntime;
			expect(runtime.jobs).toEqual([]);
			expect(runtime.jobQueue).toHaveLength(4);
			expect(runtime.items.filter((item) => item.item.id === "water")).toEqual([]);
			expect(session.getFatalError()).toBeNull();
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeWithoutSaveFx);
		}
	});
});
