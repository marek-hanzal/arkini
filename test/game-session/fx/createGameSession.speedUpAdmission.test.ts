import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createTestGameSession } from "~test/support/createTestGameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { setSpeedUpGameplayFx } from "~/game-cheat/fx/setSpeedUpGameplayFx";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";

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
		itemUid: "forge",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y,
			},
		},
	});
	for (let index = 0; index < 3; index += 1) {
		const water = yield* spawnItemFx({
			id: `runtime:water:${id}:${index}`,
			itemUid: "water",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: index + 1,
					y,
				},
			},
		});
		yield* bufferInputMaterialForTestFx({
			ownerItemId: owner.id,
			lineId,
			inputIndex: 0,
			sourceItemId: water.id,
			sourceItemRevision: water.revision,
		});
	}
	const tool = yield* spawnItemFx({
		id: `runtime:tool:${id}`,
		itemUid: "tool",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 2,
				y,
			},
		},
	});
	yield* bufferInputMaterialForTestFx({
		ownerItemId: owner.id,
		lineId,
		inputIndex: 1,
		sourceItemId: tool.id,
		sourceItemRevision: tool.revision,
	});
	return owner;
});

describe("GameSession Speed up admission", () => {
	it("admits independent owner jobs before one shared Tick settles them", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});

		try {
			await session.runFn(
				Effect.gen(function* () {
					yield* setSpeedUpGameplayFx({
						enabled: true,
					});
					yield* setCheatEnabledFx({
						enabled: true,
					});
				}),
			);
			const first = await session.runFn(
				prepareOwnerFx({
					id: "first",
					y: 0,
				}),
			);
			const second = await session.runFn(
				prepareOwnerFx({
					id: "second",
					y: 1,
				}),
			);

			await Promise.all([
				session.runFn(
					startLineFx({
						ownerItemId: first.id,
						lineId,
					}),
				),
				session.runFn(
					startLineFx({
						ownerItemId: second.id,
						lineId,
					}),
				),
			]);

			expect(
				session
					.getSnapshotFn()
					.jobs.map(({ ownerItemId }) => ownerItemId)
					.sort(),
			).toEqual(
				[
					first.id,
					second.id,
				].sort(),
			);

			await session.runFn(
				advanceRuntimeElapsedFx({
					elapsedMs: SimulationStepMs * 10,
				}),
			);
			expect(session.getSnapshotFn().jobs).toEqual([]);
		} finally {
			await Effect.runPromise(session.disposeWithoutSaveFx);
		}
	});

	it("wakes five rapidly enqueued requests after later sources reach the head without presentation settlement", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(5),
			tickIntervalMs: 1,
			speedUpMultiplier: 20,
		});
		const ownerItemId = "runtime:forge:queue-race";
		let unsubscribe: () => void = () => undefined;

		try {
			await session.runFn(
				Effect.gen(function* () {
					yield* setSpeedUpGameplayFx({
						enabled: true,
					});
					yield* setCheatEnabledFx({
						enabled: true,
					});
					yield* spawnItemFx({
						id: ownerItemId,
						itemUid: "forge",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 0,
								y: 0,
							},
						},
					});
					for (let index = 0; index < 2; index += 1) {
						yield* spawnItemFx({
							id: `runtime:water:partial:${index}`,
							itemUid: "water",
							location: {
								scope: "board",
								space: 0,
								position: {
									x: index + 1,
									y: 0,
								},
							},
						});
					}
				}),
			);

			await Promise.all(
				Array.from(
					{
						length: 5,
					},
					() =>
						session.runFn(
							enqueueLineFx({
								ownerItemId,
								lineId,
							}),
						),
				),
			);
			expect(session.getSnapshotFn().jobs).toEqual([]);
			expect(session.getSnapshotFn().jobQueue).toHaveLength(5);
			let publishWokenRuntime:
				| ((runtime: ReturnType<typeof session.getSnapshotFn>) => void)
				| undefined;
			const wokenRuntime = new Promise<ReturnType<typeof session.getSnapshotFn>>(
				(resolve) => {
					publishWokenRuntime = resolve;
				},
			);
			unsubscribe = session.subscribeTransitionsFn((transition) => {
				if (
					transition.runtime.jobQueue.length === 4 &&
					transition.runtime.jobs.length === 0
				) {
					publishWokenRuntime?.(transition.runtime);
				}
			});

			await session.runFn(
				Effect.gen(function* () {
					yield* spawnItemFx({
						id: "runtime:water:late",
						itemUid: "water",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 3,
								y: 0,
							},
						},
					});
					yield* spawnItemFx({
						id: "runtime:tool:late",
						itemUid: "tool",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 4,
								y: 0,
							},
						},
					});
				}),
			);

			const runtime = await wokenRuntime;
			expect(runtime.jobs).toEqual([]);
			expect(runtime.jobQueue).toHaveLength(4);
			expect(runtime.items.filter((item) => item.item.uid === "water")).toEqual([]);
			expect(session.getFatalErrorFn()).toBeNull();
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeWithoutSaveFx);
		}
	});
});
