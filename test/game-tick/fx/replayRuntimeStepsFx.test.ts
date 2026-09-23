import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { replayRuntimeStepsFx } from "~/game-tick/fx/replayRuntimeStepsFx";
import { projectCommittedEngineFactsFx } from "~/game-event/fx/projectCommittedEngineFactsFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import {
	boardFn,
	itemFn,
	prepareQueueFx,
	queueConfig,
	requestFn,
} from "./advanceRuntimeStepFx.queue.test/queueRuntime";

const hourMs = 60 * 60 * 1_000;
const ownerItemId = "runtime:forge";
const lineUid = "line:forge:run";

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
		lineUid: job.lineUid,
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
	it("omits a started job erased by a Template in a later step of the same commit", () => {
		const config = GameConfigSchema.parse({
			...queueConfig,
			templates: [
				{
					uid: "empty",
					title: "Empty",
					width: 5,
					height: 2,
					board: [],
				},
			],
			items: {
				...queueConfig.items,
				forge: {
					...queueConfig.items.forge,
					lines: queueConfig.items.forge!.lines.map((line) =>
						line.uid === "line:later"
							? {
									...line,
									outcome: {
										set: [
											{
												weight: 1,
												rules: [],
												roll: [
													{
														type: "guaranteed",
														outcome: [
															{
																type: "template",
																templateUid: "empty",
																rules: [],
															},
														],
													},
												],
											},
										],
									},
								}
							: line,
					),
				},
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareQueueFx(
					[
						requestFn("request:start", "line:later"),
					],
					[
						itemFn("owner:b", "forge", boardFn(1)),
					],
				);
				yield* modifyRuntimeFx(() =>
					Effect.succeed([
						undefined,
						{
							...prepared,
							items: prepared.items.map((item) => ({
								...item,
								item: config.items.forge!,
							})),
							jobs: [
								{
									id: "job:b",
									ownerItemId: "owner:b",
									lineUid: "line:later",
									durationMs: 1_000,
									remainingMs: 200,
								},
							],
						},
					] as const),
				);
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 200,
				});
				return {
					runtime: yield* readRuntimeFx(),
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.runtime.items).toEqual([]);
		expect(result.transition.events).toContainEqual(
			expect.objectContaining({
				type: "job:completed",
				jobId: "job:b",
			}),
		);
		expect(result.transition.events.some((event) => event.type === "job:started")).toBe(false);
	});

	it("keeps Autofill only while its exact admitted delivery is outbound at replay publication", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* prepareQueueFx(
					[
						requestFn("request:older", "line:older"),
					],
					[
						itemFn("source:tool", "tool", boardFn(4)),
					],
				);
				const outbound = yield* replayRuntimeStepsFx({
					elapsedMs: 200,
					runtime,
				});
				const settled = yield* replayRuntimeStepsFx({
					elapsedMs: 600,
					runtime,
				});
				return {
					outboundEvents: yield* projectCommittedEngineFactsFx({
						previousRuntime: runtime,
						runtime: outbound.runtime,
						facts: outbound.facts,
					}),
					settledEvents: yield* projectCommittedEngineFactsFx({
						previousRuntime: runtime,
						runtime: settled.runtime,
						facts: settled.facts,
					}),
				};
			}).pipe(
				useGameFx({
					config: queueConfig,
				}),
			),
		);
		expect(result.outboundEvents).toContainEqual(
			expect.objectContaining({
				type: "line-input:autofill-started",
				scheduledQuantity: 1,
			}),
		);
		expect(
			result.settledEvents.some((event) => event.type === "line-input:autofill-started"),
		).toBe(false);
	});

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
		expect(result.replay.facts).toEqual([]);
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
					lineUid,
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
