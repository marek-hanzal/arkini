import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { TickFx } from "~/v1/tick/context/TickFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";
import {
	blockedCompletionOwnerId,
	createBlockedCompletionTestConfig,
	freeCompletionOwnerId,
	prepareBlockedCompletionRuntimeFx,
} from "~test/tick/support/blockedCompletionTestRuntime";
import { createTickFailureTestConfig } from "~test/tick/support/createTickFailureTestConfig";

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
				yield* removeItemFx({
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
	it("keeps an invalidated output completion as a real Tick failure", () => {
		const config = createTickFailureTestConfig();
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:invalid-output-forge",
					itemId: "forge",
					location: {
						scope: "board",
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
				const attempt = yield* Effect.either(
					runTickRuntimeByFx({
						elapsedMs: 200,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
					tick: yield* (yield* TickFx).read,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isRight(result.attempt)) throw new Error("Expected Tick failure.");
		expect(result.attempt.left).toMatchObject({
			_tag: "ItemNotFoundError",
			itemId: "inventoryOutput",
		});
		expect(result.after).toEqual(result.before);
		expect(result.tick.pendingElapsedMs).toBe(200);
	});
});
