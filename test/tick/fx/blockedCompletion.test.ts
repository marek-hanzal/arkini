import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { TickFx } from "~/v1/tick/context/TickFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";
import {
	blockedCompletionOwnerId,
	createBlockedCompletionTestConfig,
	freeCompletionOwnerId,
	prepareBlockedCompletionRuntimeFx,
} from "~test/tick/support/blockedCompletionTestRuntime";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const createInvalidReplacementTestConfig = () => {
	const base = createJobTestConfig(1);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	const line = forge.lines[0];
	if (line === undefined) throw new Error("Expected producer line fixture.");

	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			inventoryOutput: {
				...base.items.tool,
				id: "inventoryOutput",
				title: "Inventory output",
				description: "Cannot replace one board owner.",
				scope: "inventory",
			},
			forge: {
				...forge,
				lines: [
					{
						...line,
						runtimeMs: 200,
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
													itemId: "inventoryOutput",
													quantity: {
														type: "value",
														value: 1,
													},
													placement: "replace",
													rules: [],
												},
											],
										},
									],
								},
							],
						},
					},
				],
			},
		},
	});
};

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
		expect(result.blocked.items.filter((item) => item.location.scope === "job")).toHaveLength(
			1,
		);
		expect(result.blocked.items.filter((item) => item.item.id === "ingot")).toEqual([]);

		expect(result.recovered.jobs).toEqual([]);
		expect(result.recovered.items.some((item) => item.location.scope === "job")).toBe(false);
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
	it("keeps invalid replacement completion as a real Tick failure", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:invalid-replacement-forge",
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
					config: createInvalidReplacementTestConfig(),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isRight(result.attempt)) throw new Error("Expected Tick failure.");
		expect(result.attempt.left).toMatchObject({
			_tag: "PlacementUnavailableError",
			reason: "replace:board-forbidden",
		});
		expect(result.after).toEqual(result.before);
		expect(result.tick.pendingElapsedMs).toBe(200);
	});
});
