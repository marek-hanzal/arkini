import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { readOwnerJobQueueFx } from "~/engine/job/read/readOwnerJobQueueFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { readCommittedTransitionFx } from "~/engine/runtime/read/readCommittedTransitionFx";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { TickFx } from "~/engine/tick/context/TickFx";
import { advanceRuntimeStepFx } from "~/engine/tick/internal/advanceRuntimeStepFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { existsWhen } from "~test/line/fx/support/lineTestRuntime";
import {
	createFixedStepTestConfig,
	prepareFixedStepRuntimeFx,
	summarizeFixedStepRuntime,
} from "~test/tick/support/fixedStepTestRuntime";
import { StartLineResultEnumSchema } from "~/engine/job/schema/StartLineResultEnumSchema";

const props = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
};

const removeBufferedWaterFx = Effect.fn("removeBufferedWaterFx")(function* () {
	const runtime = yield* readRuntimeFx();
	const water = runtime.items.find(
		(item) => item.item.id === "water" && item.location.scope === "input",
	);
	if (water === undefined) throw new Error("Expected buffered water.");
	yield* removeItemFx({
		itemId: water.id,
		revision: water.revision,
	});
});

const refillBufferedWaterFx = Effect.fn("refillBufferedWaterFx")(function* () {
	const water = yield* spawnItemFx({
		id: "runtime:water:refill",
		itemId: "water",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 3,
				y: 0,
			},
		},
		quantity: 3,
	});
	yield* storeInputMaterialFx({
		ownerItemId: props.ownerItemId,
		lineId: props.lineId,
		inputIndex: 0,
		sourceItemId: water.id,
		sourceItemRevision: water.revision,
		quantity: 3,
	});
});

const createLiveRuleConfig = () => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			permit: {
				...base.items.tool,
				id: "permit",
				title: "Permit",
				description: "Keeps the forge enabled.",
			},
			forge: {
				...forge,
				lines: forge.lines.map((line) => ({
					...line,
					rules: [
						{
							type: "enable",
							when: [
								existsWhen("permit"),
							],
						},
					],
				})),
			},
		},
	});
};

describe("TickFx elapsed budget", () => {
	it("does not commit stable idle ticks and advances again after an external command", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const beforeIdle = yield* readCommittedTransitionFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 2_000,
				});
				const afterIdle = yield* readCommittedTransitionFx();

				yield* prepareJobLineFx();
				yield* startLineFx(props);
				const afterCommand = yield* readCommittedTransitionFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const afterRearmedTick = yield* readCommittedTransitionFx();

				return {
					afterCommand,
					afterIdle,
					afterRearmedTick,
					beforeIdle,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.afterIdle).toBe(result.beforeIdle);
		expect(result.afterIdle.sequence).toBe(0);
		expect(result.afterRearmedTick.sequence).toBe(result.afterCommand.sequence + 1);
		expect(result.afterRearmedTick.runtime.jobs[0]?.remainingMs).toBe(800);
	});

	it("does not replay one successful elapsed budget", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx(props);
				yield* runTickRuntimeByFx({
					elapsedMs: 500,
				});
				const afterFirst = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 0,
				});
				const afterSecond = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return {
					afterFirst,
					afterSecond,
					afterRemainder: yield* readRuntimeFx(),
					state: yield* (yield* TickFx).read,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.afterFirst.jobs[0]?.remainingMs).toBe(500);
		expect(result.afterSecond).toEqual(result.afterFirst);
		expect(result.afterRemainder.jobs[0]?.remainingMs).toBe(400);
		expect(result.state.pendingElapsedMs).toBe(0);
	});

	it("serializes concurrent elapsed impulses without losing time", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx(props);
				yield* Effect.all(
					[
						runTickRuntimeByFx({
							elapsedMs: 200,
						}),
						runTickRuntimeByFx({
							elapsedMs: 300,
						}),
					],
					{
						concurrency: "unbounded",
					},
				);
				return {
					runtime: yield* readRuntimeFx(),
					state: yield* (yield* TickFx).read,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.runtime.jobs[0]?.remainingMs).toBe(500);
		expect(result.state.pendingElapsedMs).toBe(0);
	});
});

describe("runTickRuntimeByFx", () => {
	it("uses one long real-time tick to complete an active job and its whole queued chain", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const first = yield* startLineFx(props);
				const second = yield* enqueueLineFx(props);
				yield* runTickRuntimeByFx({
					elapsedMs: 2_500,
				});
				return {
					first,
					second,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2),
				}),
			),
		);

		expect(result.first.type).toBe(StartLineResultEnumSchema.enum.Started);
		expect(result.second).toMatchObject(props);
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual([]);
		expect(result.runtime.items.filter((item) => item.item.id === "water")).toEqual([]);
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "tool")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(2);
		expect(
			result.runtime.items.some(
				(item) => item.location.scope === "job" || item.location.scope === "reserved",
			),
		).toBe(false);
	});

	it("retries a blocked queue-only owner on a later fixed step", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx(props);
				yield* enqueueLineFx(props);
				yield* removeBufferedWaterFx();

				yield* runTickRuntimeByFx({
					elapsedMs: 1_000,
				});
				const blocked = yield* readRuntimeFx();

				yield* refillBufferedWaterFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					blocked,
					resumed: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2),
				}),
			),
		);

		expect(result.blocked.jobs).toEqual([]);
		expect(result.blocked.jobQueue).toHaveLength(1);
		expect(result.resumed.jobs).toHaveLength(1);
		expect(result.resumed.jobs[0]?.remainingMs).toBe(800);
		expect(result.resumed.jobQueue).toEqual([]);
	});

	it("keeps remaining time unchanged while a live rule pauses the job", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const permit = yield* spawnItemFx({
					id: "runtime:permit",
					itemId: "permit",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 4,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* prepareJobLineFx();
				yield* startLineFx(props);
				yield* removeItemFx({
					itemId: permit.id,
					revision: permit.revision,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 500,
				});
				const paused = yield* readOwnerJobQueueFx({
					ownerItemId: props.ownerItemId,
				});
				yield* spawnItemFx({
					id: "runtime:permit:return",
					itemId: "permit",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 4,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 500,
				});
				const resumed = yield* readOwnerJobQueueFx({
					ownerItemId: props.ownerItemId,
				});
				return {
					paused,
					resumed,
				};
			}).pipe(
				useGameFx({
					config: createLiveRuleConfig(),
				}),
			),
		);

		expect(result.paused[0]).toMatchObject({
			status: JobStatusEnumSchema.enum.Paused,
			job: {
				remainingMs: 1_000,
			},
		});
		expect(result.resumed[0]).toMatchObject({
			status: JobStatusEnumSchema.enum.Running,
			job: {
				remainingMs: 500,
			},
		});
	});
});

describe("fixed Tick steps", () => {
	it("admits deliveries for idle queue heads in persisted global queue order", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const olderOwnerItemId = "runtime:zzz-forge";
				const newerOwnerItemId = "runtime:aaa-forge";
				for (const [id, x] of [
					[
						olderOwnerItemId,
						0,
					],
					[
						newerOwnerItemId,
						4,
					],
				] as const) {
					yield* spawnItemFx({
						id,
						itemId: "forge",
						location: {
							scope: "board",
							space: 0,
							position: {
								x,
								y: 0,
							},
						},
						quantity: 1,
					});
				}
				yield* spawnItemFx({
					id: "runtime:shared-water",
					itemId: "water",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 3,
				});
				yield* spawnItemFx({
					id: "runtime:shared-tool",
					itemId: "tool",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				});
				const prepared = yield* readRuntimeFx();
				const stepped = yield* advanceRuntimeStepFx({
					...prepared,
					jobQueue: [
						{
							id: "job:older-global-request",
							ownerItemId: olderOwnerItemId,
							lineId: props.lineId,
						},
						{
							id: "job:newer-global-request",
							ownerItemId: newerOwnerItemId,
							lineId: props.lineId,
						},
					],
				});
				return stepped.runtime;
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2),
				}),
			),
		);

		expect(result.jobs).toEqual([]);
		expect(result.jobQueue).toEqual([
			{
				id: "job:older-global-request",
				ownerItemId: "runtime:zzz-forge",
				lineId: props.lineId,
			},
			{
				id: "job:newer-global-request",
				ownerItemId: "runtime:aaa-forge",
				lineId: props.lineId,
			},
		]);
		const deliveries = result.items.filter((item) => item.location.scope === "delivery");
		expect(deliveries).toHaveLength(2);
		expect(
			deliveries.every(
				(item) =>
					item.location.scope === "delivery" &&
					item.location.phase === "outbound" &&
					item.location.target.ownerItemId === "runtime:zzz-forge",
			),
		).toBe(true);
	});

	it("uses one step-start live-rule snapshot regardless of runtime job-array order", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* prepareFixedStepRuntimeFx();
				const forward = yield* advanceRuntimeStepFx(runtime);
				const reversed = yield* advanceRuntimeStepFx({
					...runtime,
					jobs: [
						...runtime.jobs,
					].reverse(),
				});
				const next = yield* advanceRuntimeStepFx(forward.runtime);
				const third = yield* advanceRuntimeStepFx(next.runtime);
				return {
					forward: summarizeFixedStepRuntime(forward.runtime),
					next: summarizeFixedStepRuntime(next.runtime),
					reversed: summarizeFixedStepRuntime(reversed.runtime),
					third: summarizeFixedStepRuntime(third.runtime),
				};
			}).pipe(
				useGameFx({
					config: createFixedStepTestConfig(),
				}),
			),
		);

		expect(result.forward).toEqual({
			dependentRemainingMs: 400,
			enablerActive: true,
			permitQuantity: 0,
		});
		expect(result.reversed).toEqual(result.forward);
		expect(result.next).toEqual({
			dependentRemainingMs: 400,
			enablerActive: false,
			permitQuantity: 1,
		});
		expect(result.third).toEqual({
			dependentRemainingMs: 300,
			enablerActive: false,
			permitQuantity: 1,
		});
	});

	it("matches one long elapsed advancement with equivalent fixed-step calls", () => {
		const run = (elapsedParts: readonly number[]) =>
			Effect.runSync(
				Effect.gen(function* () {
					yield* prepareFixedStepRuntimeFx();
					for (const elapsedMs of elapsedParts) {
						yield* runTickRuntimeByFx({
							elapsedMs,
						});
					}
					return summarizeFixedStepRuntime(yield* readRuntimeFx());
				}).pipe(
					useGameFx({
						config: createFixedStepTestConfig(),
					}),
				),
			);

		expect(
			run([
				400,
			]),
		).toEqual(
			run([
				200,
				200,
			]),
		);
	});
});
