import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";
import { storeInventoryItemFx } from "~/item-interaction/fx/storeInventoryItemFx";
import { releaseInventoryItemFx } from "~/item-interaction/fx/releaseInventoryItemFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const boardPermit: WhenSchema.Type = {
	type: "exists",
	query: {
		scope: "board",
		distance: "close",
		selector: {
			type: "item",
			itemId: "permit",
		},
	},
};

const remainingFn = (runtime: RuntimeSchema.Type) =>
	runtime.items.find((item) => item.id === "runtime:clock")?.schedule?.remainingDurationMs;

describe("Clock rules at passive physical origins", () => {
	it.each([
		{
			type: "enable" as const,
			expected: [
				200,
				200,
				100,
			],
		},
		{
			type: "disable" as const,
			expected: [
				300,
				200,
				200,
			],
		},
	])("keeps $type rule timing coherent across an Inventory roundtrip", ({ type, expected }) => {
		const config = createClockConfig({
			scope: "any",
			lines: [],
			clock: {
				intervalMs: undefined,
				durationMs: 300,
				rules: [
					{
						type,
						when: [
							boardPermit,
						],
					},
				],
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				yield* spawnClockItemFx("permit", 1);
				const board = yield* tickClockFx(100);
				const owner = yield* readRuntimeItemByIdFx({
					itemId: "runtime:clock",
					runtime: board,
				});
				if (owner.location.scope !== "board") throw new Error("Expected Board Clock.");
				yield* storeInventoryItemFx({
					sourceItemId: owner.id,
					sourceRevision: owner.revision,
					sourceLocation: owner.location,
				});
				const stored = yield* tickClockFx(100);
				const passive = yield* readRuntimeItemByIdFx({
					itemId: owner.id,
					runtime: stored,
				});
				if (passive.location.scope !== "inventory")
					throw new Error("Expected Inventory Clock.");
				yield* releaseInventoryItemFx({
					itemId: passive.id,
					revision: passive.revision,
					location: passive.location,
				});
				const returned = yield* tickClockFx(100);
				return [
					remainingFn(board),
					remainingFn(stored),
					remainingFn(returned),
				];
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result).toEqual(expected);
	});

	it("settles expiry and its output rules after an Inventory move without a Board origin", () => {
		const config = createClockConfig({
			scope: "any",
			lines: [],
			clock: {
				intervalMs: undefined,
				durationMs: 100,
				onExpire: {
					set: [
						{
							weight: 1,
							rules: [],
							roll: [
								{
									type: "guaranteed",
									drop: [
										{
											itemId: "expired",
											quantity: {
												min: 1,
												max: 1,
											},
											placement: "drop",
											rules: [
												{
													type: "enable",
													when: [
														boardPermit,
													],
												},
											],
										},
										{
											itemId: "result",
											quantity: {
												min: 1,
												max: 1,
											},
											placement: "drop",
											rules: [
												{
													type: "disable",
													when: [
														boardPermit,
													],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnClockItemFx();
				yield* spawnClockItemFx("permit", 1);
				yield* storeInventoryItemFx({
					sourceItemId: owner.id,
					sourceRevision: owner.revision,
					sourceLocation: owner.location,
				});
				return yield* tickClockFx(100);
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(
			result.items.some((item) => item.item.id === "clock" || item.item.id === "expired"),
		).toBe(false);
		expect(result.items.filter((item) => item.item.id === "result")).toMatchObject([
			{
				quantity: 1,
			},
		]);
		expect(result.jobs).toEqual([]);
		expect(result.jobQueue).toEqual([]);
	});
});
