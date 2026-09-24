import { LineSchema } from "~/production-line/schema/LineSchema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	generatedSpaceTestConfigFn,
	generatedSpaceStateFn,
	enterGeneratedSpaceFx,
	removeGeneratedSpaceItemFx,
} from "~test/space/support/generatedSpaceTestConfig";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";

describe("Generated Space settlement", () => {
	it("discards active interior work without settling its output on later ticks", () => {
		const config = generatedSpaceTestConfigFn();
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
				const entered = yield* enterGeneratedSpaceFx("first");
				const worker = entered.items.find(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === entered.currentSpace,
				)!;
				yield* enqueueDefaultLineFx({
					ownerItemId: worker.id,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const working = yield* readRuntimeFx();
				const removed = yield* removeGeneratedSpaceItemFx("first");
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
					state: generatedSpaceStateFn(),
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
		const config = generatedSpaceTestConfigFn();
		config.items.warehouse!.clock = {
			durationMs: 100,
			enable: true,
			rules: [],
			onExpire: config.items.warehouse!.lines[0]!.outcome,
		};
		const state = generatedSpaceStateFn([
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
					elapsedMs: 100,
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
