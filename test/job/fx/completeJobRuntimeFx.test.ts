import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { attemptJobCompletionFx } from "~/v1/job/fx/attemptJobCompletionFx";
import { completeJobRuntimeFx } from "~/v1/job/fx/completeJobRuntimeFx";
import { makeJobCompletionRandom } from "~/v1/job/random/makeJobCompletionRandom";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import { useGameFx } from "~/v1/game/fx/useGameFx";
import { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import {
	createRandomCompletionConfig,
	prepareRandomCompletionRuntimeFx,
	projectRandomCompletionItems,
} from "~test/job/support/randomCompletionTestRuntime";

describe("completeJobRuntimeFx", () => {
	it("replays one stable completion outcome across blocking, retry and restore", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareRandomCompletionRuntimeFx();
				const immediate = yield* completeJobRuntimeFx({
					job: prepared.job,
					runtime: prepared.freeRuntime,
				}).pipe(
					Effect.withRandom(
						Random.fixed([
							0.01,
						]),
					),
				);
				const blocked = yield* attemptJobCompletionFx({
					job: prepared.job,
					runtime: prepared.fullRuntime,
				}).pipe(
					Effect.withRandom(
						Random.fixed([
							0.01,
						]),
					),
				);
				const retried = yield* completeJobRuntimeFx({
					job: prepared.job,
					runtime: prepared.freeRuntime,
				}).pipe(
					Effect.withRandom(
						Random.fixed([
							0.99,
						]),
					),
				);
				const restoredRuntime = RuntimeSchema.parse(
					JSON.parse(JSON.stringify(prepared.freeRuntime)),
				);
				const restoredJob = restoredRuntime.jobs[0];
				if (restoredJob === undefined) throw new Error("Expected restored completion job.");
				const restored = yield* completeJobRuntimeFx({
					job: restoredJob,
					runtime: restoredRuntime,
				}).pipe(
					Effect.withRandom(
						Random.fixed([
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

	it("derives distinct deterministic streams for distinct jobs", () => {
		const baseJob = {
			id: "job:completion-random:first",
			ownerItemId: "runtime:owner",
			lineId: "line:owner:run",
			durationMs: 200,
			remainingMs: 0,
			revision: "revision:first",
		} satisfies JobSchema.Type;
		const secondJob = {
			...baseJob,
			id: "job:completion-random:second",
			revision: "revision:second",
		} satisfies JobSchema.Type;
		const readStream = (job: JobSchema.Type) =>
			Effect.runSync(
				Effect.all([
					Random.next,
					Random.next,
					Random.next,
					Random.next,
				]).pipe(Effect.withRandom(makeJobCompletionRandom(job))),
			);

		expect(readStream(secondJob)).not.toEqual(readStream(baseJob));
		expect(readStream(baseJob)).toEqual(readStream(baseJob));
	});
});
