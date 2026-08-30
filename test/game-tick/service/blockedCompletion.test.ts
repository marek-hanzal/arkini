import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { removeRuntimeItemForTestFx } from "~test/support/item-interaction/removeRuntimeItemForTestFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import {
	blockedCompletionOwnerId,
	createBlockedCompletionTestConfig,
	freeCompletionOwnerId,
	prepareBlockedCompletionRuntimeFx,
} from "~test/game-tick/support/blockedCompletionTestRuntime";
import { createTickFailureTestConfig } from "~test/game-tick/support/createTickFailureTestConfig";

describe("blocked job completion", () => {
	it("keeps one ready job blocked without rolling back unrelated owner completion", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareBlockedCompletionRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 1_000,
				});
				const blocked = yield* readRuntimeFx();
				const blocker = blocked.items.find((item) => item.item.id === "blocker");
				if (blocker === undefined) throw new Error("Expected completion blocker.");
				yield* removeRuntimeItemForTestFx({
					itemId: blocker.id,
					revision: blocker.revision,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					blocked,
					recovered: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createBlockedCompletionTestConfig(),
				}),
			),
		);

		expect(result.blocked.jobs).toEqual([
			expect.objectContaining({
				ownerItemId: blockedCompletionOwnerId,
				remainingMs: 0,
			}),
		]);
		expect(result.blocked.jobs.some((job) => job.ownerItemId === freeCompletionOwnerId)).toBe(
			false,
		);
		expect(
			result.blocked.items.map((item) =>
				item.location.scope === "job" || item.location.scope === "reserved"
					? item.location.scope
					: undefined,
			),
		).toEqual(
			expect.arrayContaining([
				"job",
				"reserved",
			]),
		);
		expect(result.blocked.items.filter((item) => item.item.id === "ingot")).toEqual([]);

		expect(result.recovered.jobs).toEqual([]);
		expect(
			result.recovered.items.some(
				(item) => item.location.scope === "job" || item.location.scope === "reserved",
			),
		).toBe(false);
		expect(
			result.recovered.items
				.filter((item) => item.item.id === "tool")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(1);
		expect(
			result.recovered.items
				.filter((item) => item.item.id === "ingot")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(1);
	});
	it("consumes the attempted budget when output completion fatally fails", () => {
		const config = createTickFailureTestConfig();
		const result = Effect.runSync(
			Effect.gen(function* () {
				const output = config.items.inventoryOutput;
				if (output === undefined) throw new Error("Expected failure output fixture.");
				const owner = yield* spawnItemFx({
					id: "runtime:invalid-output-forge",
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
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				});
				delete (config.items as Record<string, unknown>).inventoryOutput;
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					runTickRuntimeByFx({
						elapsedMs: 200,
					}),
				);
				const afterFailure = yield* readRuntimeFx();
				(config.items as Record<string, unknown>).inventoryOutput = output;
				yield* runTickRuntimeByFx({
					elapsedMs: 0,
				});
				const afterNoRetry = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return {
					afterFailure,
					afterNoRetry,
					attempt,
					before,
					recovered: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isSuccess(result.attempt)) throw new Error("Expected Tick failure.");
		expect(result.attempt.failure).toMatchObject({
			_tag: "ItemNotFoundError",
			itemId: "inventoryOutput",
		});
		expect(result.afterFailure).toEqual(result.before);
		expect(result.afterNoRetry).toEqual(result.before);
		expect(result.recovered.jobs[0]?.remainingMs).toBe(100);
	});
});
