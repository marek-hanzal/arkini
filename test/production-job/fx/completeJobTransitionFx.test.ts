import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { attemptJobCompletionFx } from "~/production-job/fx/attemptJobCompletionFx";
import { makeJobCompletionRandomFx } from "~/production-job/random/makeJobCompletionRandomFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import {
	createRandomCompletionConfig,
	prepareRandomCompletionRuntimeFx,
	projectRandomCompletionItems,
} from "~test/production-job/support/randomCompletionTestRuntime";
import { completeJobRuntimeForTestFx } from "~test/production-job/support/completeJobRuntimeForTestFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

describe("job completion transition", () => {
	it("replays one stable completion outcome across blocking, retry and restore", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareRandomCompletionRuntimeFx();
				const immediate = yield* completeJobRuntimeForTestFx({
					jobId: prepared.job.id,
					runtime: prepared.freeRuntime,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.01,
						]),
					),
				);
				const blocked = yield* attemptJobCompletionFx({
					jobId: prepared.job.id,
					runtime: prepared.fullRuntime,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.01,
						]),
					),
				);
				const retried = yield* completeJobRuntimeForTestFx({
					jobId: prepared.job.id,
					runtime: prepared.freeRuntime,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.99,
						]),
					),
				);
				const restoredRuntime = RuntimeSchema.parse(
					JSON.parse(JSON.stringify(prepared.freeRuntime)),
				);
				const restoredJob = restoredRuntime.jobs[0];
				if (restoredJob === undefined) throw new Error("Expected restored completion job.");
				const restored = yield* completeJobRuntimeForTestFx({
					jobId: restoredJob.id,
					runtime: restoredRuntime,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.5,
						]),
					),
				);

				return {
					blocked,
					immediate: projectRandomCompletionItems(immediate),
					restored: projectRandomCompletionItems(restored),
					retried: projectRandomCompletionItems(retried),
				};
			}).pipe(
				useGameFx({
					config: createRandomCompletionConfig(),
				}),
			),
		);

		expect(result.blocked.type).toBe("blocked");
		expect(result.immediate).not.toEqual([]);
		expect(result.retried).toEqual(result.immediate);
		expect(result.restored).toEqual(result.immediate);
	});

	it("reports exact spawned output identities from the committed completion", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareRandomCompletionRuntimeFx();
				return yield* attemptJobCompletionFx({
					jobId: prepared.job.id,
					runtime: prepared.freeRuntime,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.01,
						]),
					),
				);
			}).pipe(
				useGameFx({
					config: createRandomCompletionConfig(),
				}),
			),
		);

		if (result.type !== "completed") throw new Error("Expected completed job.");
		const outputs = result.runtime.items.filter(
			(item) => item.item.id === "outputA" || item.item.id === "outputB",
		);
		expect(outputs).not.toEqual([]);
		for (const item of outputs) {
			expect(result.events).toContainEqual({
				type: GameEventEnumSchema.enum.ItemSpawned,
				itemId: item.id,
				canonicalItemId: item.item.id,
				originItemId: "runtime:random-forge",
				location: item.location,
				quantity: item.quantity,
			});
		}
	});

	it("rejects an absent stale job before producing output", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareRandomCompletionRuntimeFx();
				return yield* Effect.result(
					completeJobRuntimeForTestFx({
						jobId: prepared.job.id,
						runtime: {
							...prepared.freeRuntime,
							jobs: [],
						},
					}),
				);
			}).pipe(
				useGameFx({
					config: createRandomCompletionConfig(),
				}),
			),
		);

		expect(result).toMatchObject({
			_tag: "Failure",
			failure: {
				_tag: "JobNotFoundError",
			},
		});
	});

	it("rejects a live running job at the completion boundary", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareRandomCompletionRuntimeFx();
				const runningJob = {
					...prepared.job,
					remainingMs: 200,
				} satisfies JobSchema.Type;
				return yield* Effect.result(
					attemptJobCompletionFx({
						jobId: runningJob.id,
						runtime: {
							...prepared.freeRuntime,
							jobs: [
								runningJob,
							],
						},
					}),
				);
			}).pipe(
				useGameFx({
					config: createRandomCompletionConfig(),
				}),
			),
		);

		expect(result).toMatchObject({
			_tag: "Failure",
			failure: {
				_tag: "JobNotReadyError",
				remainingMs: 200,
			},
		});
	});

	it("derives distinct deterministic streams for distinct jobs", () => {
		const baseJob = {
			id: "job:completion-random:first",
			ownerItemId: "runtime:owner",
			lineId: "line:owner:run",
			durationMs: 200,
			remainingMs: 0,
		} satisfies JobSchema.Type;
		const secondJob = {
			...baseJob,
			id: "job:completion-random:second",
		} satisfies JobSchema.Type;
		const readStream = (job: JobSchema.Type) =>
			Effect.runSync(
				makeJobCompletionRandomFx({
					job,
					program: Effect.all([
						Random.next,
						Random.next,
						Random.next,
						Random.next,
					]),
				}),
			);

		expect(readStream(secondJob)).not.toEqual(readStream(baseJob));
		expect(readStream(baseJob)).toEqual(readStream(baseJob));
	});
});
