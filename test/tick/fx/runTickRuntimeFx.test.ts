import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { readOwnerJobQueueFx } from "~/v1/job/read/readOwnerJobQueueFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { TickFx } from "~/v1/tick/context/TickFx";
import { advanceRuntimeStepFx } from "~/v1/tick/internal/advanceRuntimeStepFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { existsWhen } from "~test/line/fx/support/lineTestRuntime";
import {
	createFixedStepTestConfig,
	prepareFixedStepRuntimeFx,
	summarizeFixedStepRuntime,
} from "~test/tick/support/fixedStepTestRuntime";

const props = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
};

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

		expect(result.afterFirst.jobs[0]?.remainingMs).toBe(600);
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

		expect(result.runtime.jobs[0]?.remainingMs).toBe(600);
		expect(result.state.pendingElapsedMs).toBe(100);
	});
});

describe("runTickRuntimeByFx", () => {
	it("uses one long real-time tick to complete an active job and its whole queued chain", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const first = yield* startLineFx(props);
				const second = yield* startLineFx(props);
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

		expect(result.first.type).toBe("started");
		expect(result.second.type).toBe("queued");
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual([]);
		expect(result.runtime.items.filter((item) => item.item.id === "water")).toEqual([]);
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "tool")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(2);
		expect(result.runtime.items.some((item) => item.location.scope === "job")).toBe(false);
	});

	it("keeps remaining time unchanged while a live rule pauses the job", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const permit = yield* spawnItemFx({
					id: "runtime:permit",
					itemId: "permit",
					location: {
						scope: "board",
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
			status: "paused",
			job: {
				remainingMs: 1_000,
			},
		});
		expect(result.resumed[0]).toMatchObject({
			status: "running",
			job: {
				remainingMs: 400,
			},
		});
	});
});

describe("fixed Tick steps", () => {
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
				return {
					forward: summarizeFixedStepRuntime(forward.runtime),
					next: summarizeFixedStepRuntime(next.runtime),
					reversed: summarizeFixedStepRuntime(reversed.runtime),
				};
			}).pipe(
				useGameFx({
					config: createFixedStepTestConfig(),
				}),
			),
		);

		expect(result.forward).toEqual({
			dependentRemainingMs: 400,
			enablerActive: false,
			permitQuantity: 1,
		});
		expect(result.reversed).toEqual(result.forward);
		expect(result.next).toEqual({
			dependentRemainingMs: 200,
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
