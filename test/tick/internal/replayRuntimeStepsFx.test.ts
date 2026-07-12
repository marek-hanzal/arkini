import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { moveItemFx } from "~/v1/runtime/write/moveItemFx";
import { advanceRuntimeStepFx } from "~/v1/tick/internal/advanceRuntimeStepFx";
import { replayRuntimeStepsFx } from "~/v1/tick/internal/replayRuntimeStepsFx";
import { TickStepMs } from "~/v1/tick/TickStepMs";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const hourMs = 60 * 60 * 1_000;
const ownerItemId = "runtime:forge";
const lineId = "line:forge:run";

const summarizeRuntime = (runtime: RuntimeSchema.Type) => ({
	items: runtime.items
		.map((item) => ({
			itemId: item.item.id,
			location: item.location,
			quantity: item.quantity,
		}))
		.sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second))),
	jobQueue: runtime.jobQueue,
	jobs: runtime.jobs.map((job) => ({
		lineId: job.lineId,
		ownerItemId: job.ownerItemId,
		remainingMs: job.remainingMs,
	})),
});

const moveOwnerToInventoryFx = Effect.fn("moveOwnerToInventoryFx")(function* () {
	const runtime = yield* readRuntimeFx();
	const owner = runtime.items.find((item) => item.id === ownerItemId);
	if (owner === undefined) throw new Error("Expected forge owner.");
	yield* moveItemFx({
		itemId: owner.id,
		location: {
			scope: "inventory",
			position: {
				x: 0,
				y: 0,
			},
		},
		revision: owner.revision,
	});
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
		expect(result.replay.processedSteps).toBe(1);
		expect(result.replay.skippedSteps).toBe(hourMs / TickStepMs - 1);
	});

	it("fast-forwards a stable inventory-paused job after one domain step", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx({
					ownerItemId,
					lineId,
				});
				yield* moveOwnerToInventoryFx();
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
					config: createJobTestConfig(2, "any"),
				}),
			),
		);

		expect(result.replay.runtime).toBe(result.runtime);
		expect(result.replay.runtime.jobs[0]?.remainingMs).toBe(1_000);
		expect(result.replay.processedSteps).toBe(1);
		expect(result.replay.skippedSteps).toBe(hourMs / TickStepMs - 1);
	});

	it("replays every changing step before fast-forwarding the stable remainder", () => {
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
				const literal = yield* replayLiterallyFx(runtime, 6);
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
		expect(result.replay.processedSteps).toBe(6);
		expect(result.replay.skippedSteps).toBe(hourMs / TickStepMs - 6);
	});
});
