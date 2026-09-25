import { LineSchema } from "~/production-line/schema/LineSchema";
import { createExpiryLine } from "~test/game-config-validation/support/gameValidationTestSource";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	inventoryTestConfigFn,
	inventoryStateFn,
	enterInventoryFx,
	removeInventoryItemFx,
} from "~test/space/support/inventoryTestConfig";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";

describe("Inventory settlement", () => {
	it("discards active interior work without settling its output on later ticks", () => {
		const config = inventoryTestConfigFn();
		config.items.token!.lines = [
			LineSchema.parse({
				...config.items.warehouse!.lines[0]!,
				uid: "work",
				default: true,
				title: "Work",
				description: "Work",
				runtimeMs: 1000,
				input: [
					{
						type: "simple",
					},
				],
				rules: [],
				outcome: {
					set: [
						{
							rules: [],
							roll: [
								{
									type: "guaranteed",
									outcome: [
										{
											type: "item",
											itemUid: "token",
											placement: "drop",
											quantity: {
												min: 1,
												max: 1,
											},
											rules: [],
										},
									],
								},
							],
						},
					],
				},
			}),
		];
		const result = Effect.runSync(
			Effect.gen(function* () {
				const entered = yield* enterInventoryFx("first");
				const worker = entered.items.find(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === entered.currentSpace,
				)!;
				yield* enqueueDefaultLineFx({
					ownerItemId: worker.id,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const working = yield* readRuntimeFx();
				const removed = yield* removeInventoryItemFx("first");
				yield* runTickRuntimeByFx({
					elapsedMs: 2000,
				});
				return {
					worker,
					working,
					removed,
					later: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
			),
		);
		expect(result.working.jobs.some((job) => job.ownerItemId === result.worker.id)).toBe(true);
		expect(result.removed.jobs).toEqual([]);
		expect(result.removed.jobQueue).toEqual([]);
		expect(result.later.items.map((item) => item.id)).toEqual([
			"second",
			"cargo",
		]);
		expect(result.later.templateUidBySpace).toEqual({});
	});

	it("expiry cannot create a room after destroying its owner", () => {
		const config = inventoryTestConfigFn();
		config.items.warehouse!.clock = {
			durationMs: 100,
			enable: true,
			rules: [],
		};
		config.items.warehouse!.lines.push(
			createExpiryLine(config.items.warehouse!.lines[0]!.outcome!, "expiry:warehouse"),
		);
		const state = inventoryStateFn([
			{
				id: "first",
				itemUid: "warehouse",
				x: 0,
			},
		]);
		state.items[0]!.schedule = {
			remainingDurationMs: 100,
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);
		expect(result.items).toEqual([]);
		expect(result.templateUidBySpace).toEqual({});
		expect(result.currentSpace).toBe(0);
		expect(result.previousSpace).toBeUndefined();
	});
});
