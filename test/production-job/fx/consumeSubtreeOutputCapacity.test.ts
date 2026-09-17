import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { sourceLocation } from "~test/production-input/support/inputRuntimeTestConfig";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";

import {
	configFn,
	externalPayerConfigFn,
	setupFx,
} from "./consumeSubtreeOutputCapacity.test/fixture";

const command = {
	ownerItemId: "outer",
	lineId: "recycle",
};

describe("consume subtree output capacity", () => {
	it("admits and starts replacement output while retaining its full active-job reservation", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* setupFx;
				yield* enqueueLineFx(command);
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 100,
				});
				const running = yield* readRuntimeFx();
				const competing = yield* spawnItemFx({
					id: "competing-water",
					itemId: "water",
					location: sourceLocation(4),
					quantity: 1,
				}).pipe(Effect.result);
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 100,
				});
				return {
					running,
					competing,
					completed: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: configFn(),
				}),
			),
		);

		expect(result.running.jobs).toHaveLength(1);
		expect(result.running.items.map((item) => item.id).sort()).toEqual([
			"inner",
			"outer",
		]);
		expect(result.competing).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "PlacementUnavailableError",
					itemId: "water",
					reason: "item:max-count",
					remainingQuantity: 1,
				}),
			),
		);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.items.some((item) => item.id === "inner")).toBe(false);
		expect(
			result.completed.items
				.filter((item) => item.item.id === "water")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(2);
	});

	it.each([
		false,
		true,
	])(
		"uses immediate subtree disposal for external depletion with active payer = %s",
		(active) => {
			const completed = Effect.runSync(
				Effect.gen(function* () {
					yield* setupFx;
					yield* spawnItemFx({
						id: "payer",
						itemId: "payer",
						location: sourceLocation(4),
						quantity: 1,
					});
					if (active) {
						yield* enqueueLineFx({
							ownerItemId: "payer",
							lineId: "work",
						});
						yield* advanceRuntimeElapsedFx({
							elapsedMs: 100,
						});
					}
					yield* enqueueLineFx(command);
					yield* advanceRuntimeElapsedFx({
						elapsedMs: 10000,
					});
					return yield* readRuntimeFx();
				}).pipe(
					useGameFx({
						config: externalPayerConfigFn(),
					}),
				),
			);

			expect(completed.jobs).toEqual([]);
			expect(
				completed.items.some(
					(item) => item.id === "payer" || item.id === "inner" || item.id === "vessel",
				),
			).toBe(false);
			expect(
				completed.items
					.filter((item) => item.item.id === "water")
					.reduce((sum, item) => sum + item.quantity, 0),
			).toBe(2);
		},
	);

	it.each([
		{
			name: "preserved reserve subtree",
			mode: "reserve" as const,
			outputQuantity: 2,
		},
		{
			name: "output exceeding released capacity",
			mode: "consume" as const,
			outputQuantity: 3,
		},
	])(
		"rejects $name at both enqueue and direct start without changing material",
		({ mode, outputQuantity }) => {
			const result = Effect.runSync(
				Effect.gen(function* () {
					yield* setupFx;
					const before = yield* readRuntimeFx();
					const queued = yield* enqueueLineFx(command).pipe(Effect.result);
					const started = yield* startLineFx(command).pipe(Effect.result);
					return {
						before,
						queued,
						started,
						after: yield* readRuntimeFx(),
					};
				}).pipe(
					useGameFx({
						config: configFn({
							mode,
							outputQuantity,
						}),
					}),
				),
			);

			for (const rejected of [
				result.queued,
				result.started,
			]) {
				expect(rejected).toEqual(
					Result.fail(
						expect.objectContaining({
							_tag: "OutputCapacityError",
							itemId: "water",
							maxCount: 2,
						}),
					),
				);
			}
			expect(result.after).toEqual(result.before);
		},
	);
});
