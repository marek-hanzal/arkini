import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";

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
});
