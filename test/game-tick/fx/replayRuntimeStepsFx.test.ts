import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { replayRuntimeStepsFx } from "~/game-tick/fx/replayRuntimeStepsFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";

const hourMs = 60 * 60 * 1_000;
const ownerItemId = "runtime:forge";
const lineId = "line:forge:run";

const summarizeRuntime = (runtime: RuntimeSchema.Type) => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace: 0,
	templateUidBySpace: {},
	items: runtime.items
		.map((item) => ({
			itemId: item.item.uid,
			location: item.location,
		}))
		.sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second))),
	jobQueue: runtime.jobQueue,
	jobs: runtime.jobs.map((job) => ({
		lineId: job.lineId,
		ownerItemId: job.ownerItemId,
		remainingMs: job.remainingMs,
	})),
});

const replayLiterallyFx = Effect.fn("replayLiterallyFx")(function* (
	runtime: RuntimeSchema.Type,
	steps: number,
) {
	let draft = runtime;
	for (let index = 0; index < steps; index += 1) {
		draft = (yield* advanceRuntimeStepFx(draft)).runtime;
	}
	return draft;
});

describe("replayRuntimeStepsFx", () => {
	it("fast-forwards an empty one-hour backlog after one stable no-op step", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* readRuntimeFx();
				const replay = yield* replayRuntimeStepsFx({
					elapsedMs: hourMs,
					runtime,
				});
				return {
					replay,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.replay.runtime).toBe(result.runtime);
		expect(result.replay.events).toEqual([]);
		expect(result.replay.isStable).toBe(true);
		expect(result.replay.processedSteps).toBe(1);
		expect(result.replay.skippedSteps).toBe(hourMs / SimulationStepMs - 1);
	});

	it("replays every changing step before fast-forwarding the stable remainder", () => {
		const stepsUntilStable = 1_000 / SimulationStepMs + 1;
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx({
					ownerItemId,
					lineId,
				});
				const runtime = yield* readRuntimeFx();
				const replay = yield* replayRuntimeStepsFx({
					elapsedMs: hourMs,
					runtime,
				});
				const literal = yield* replayLiterallyFx(runtime, stepsUntilStable);
				return {
					literal,
					replay,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(summarizeRuntime(result.replay.runtime)).toEqual(summarizeRuntime(result.literal));
		expect(result.replay.runtime.jobs).toEqual([]);
		expect(result.replay.isStable).toBe(true);
		expect(result.replay.processedSteps).toBe(stepsUntilStable);
		expect(result.replay.skippedSteps).toBe(hourMs / SimulationStepMs - stepsUntilStable);
	});
});
