import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { projectCommittedEngineFactsFx } from "~/game-event/fx/projectCommittedEngineFactsFx";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import {
	boardFn,
	bufferFn,
	createContendedQueueConfigFn,
	itemFn,
	prepareQueueFx,
	queueConfig,
	requestFn,
} from "./advanceRuntimeStepFx.queue.test/queueRuntime";

describe("Tick queue progress priority", () => {
	it("preserves a bypassed request and its buffer, then restores its priority after unblocking", () => {
		const older = requestFn("request:older", "line:older");
		const later = requestFn("request:later", "line:later");
		const last = requestFn("request:last", "line:later");
		const buffer = bufferFn();
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareQueueFx(
					[
						older,
						later,
						last,
					],
					[
						buffer,
					],
				);
				const bypassed = yield* advanceRuntimeStepFx(prepared);
				const active = yield* advanceRuntimeStepFx(bypassed.runtime);
				const bypassedEvents = yield* projectCommittedEngineFactsFx({
					previousRuntime: prepared,
					runtime: bypassed.runtime,
					facts: bypassed.facts,
				});
				const activeEvents = yield* projectCommittedEngineFactsFx({
					previousRuntime: bypassed.runtime,
					runtime: active.runtime,
					facts: active.facts,
				});
				// Deliver the missing buffered unit while the younger job is still active.
				let draft = {
					...active.runtime,
					items: [
						...active.runtime.items,
						bufferFn("buffer:second"),
					],
				};
				for (let step = 0; step < 8; step += 1) {
					draft = (yield* advanceRuntimeStepFx(draft)).runtime;
				}
				return {
					bypassed,
					bypassedEvents,
					active,
					activeEvents,
					restored: draft,
				};
			}).pipe(
				useGameFx({
					config: queueConfig,
				}),
			),
		);

		expect(result.bypassed.runtime.jobs).toMatchObject([
			{
				ownerItemId: "owner:a",
				lineId: "line:later",
				remainingMs: 900,
			},
		]);
		expect(result.bypassed.runtime.jobQueue).toEqual([
			older,
			last,
		]);
		expect(result.bypassed.runtime.items.find((item) => item.id === buffer.id)).toEqual(buffer);
		expect(result.bypassedEvents).toMatchObject([
			{
				type: "job:started",
				lineId: "line:later",
			},
		]);
		expect(result.active.runtime.jobQueue).toEqual([
			older,
			last,
		]);
		expect(result.active.runtime.items.find((item) => item.id === buffer.id)).toEqual(buffer);
		expect(result.activeEvents).toEqual([]);
		expect(result.restored.jobs).toMatchObject([
			{
				ownerItemId: "owner:a",
				lineId: "line:older",
				remainingMs: 1_000,
			},
		]);
		expect(result.restored.jobQueue).toEqual([
			last,
		]);
		expect(result.restored.items.find((item) => item.id === buffer.id)).toMatchObject({
			location: {
				scope: "job",
				jobId: result.restored.jobs[0]?.id,
			},
		});
	});

	it("lets useful Autofill win one pass, but bypasses an older request only waiting on that delivery next pass", () => {
		const older = requestFn("request:older", "line:older");
		const later = requestFn("request:later", "line:later");
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareQueueFx(
					[
						older,
						later,
					],
					[
						itemFn("source:tool", "tool", boardFn(4)),
					],
				);
				const scheduled = yield* advanceRuntimeStepFx(prepared);
				const bypassed = yield* advanceRuntimeStepFx(scheduled.runtime);
				return {
					scheduled,
					bypassed,
				};
			}).pipe(
				useGameFx({
					config: queueConfig,
				}),
			),
		);

		expect(result.scheduled.runtime.jobs).toEqual([]);
		expect(result.scheduled.runtime.jobQueue).toEqual([
			older,
			later,
		]);
		expect(
			result.scheduled.runtime.items.find((item) => item.id === "source:tool"),
		).toMatchObject({
			location: {
				scope: "delivery",
				phase: "outbound",
				remainingDurationMs: 400,
				target: {
					ownerItemId: "owner:a",
					lineId: "line:older",
				},
			},
		});
		expect(result.bypassed.runtime.jobs).toMatchObject([
			{
				ownerItemId: "owner:a",
				lineId: "line:later",
			},
		]);
		expect(result.bypassed.runtime.jobQueue).toEqual([
			older,
		]);
		expect(
			result.bypassed.runtime.items.find((item) => item.id === "source:tool"),
		).toMatchObject({
			location: {
				scope: "delivery",
				phase: "outbound",
				remainingDurationMs: 300,
				target: {
					ownerItemId: "owner:a",
					lineId: "line:older",
				},
			},
		});
	});

	it("keeps interleaved global order when a blocked A1 precedes B1 and A2 competing for one source", () => {
		const queue = [
			requestFn("request:a1", "line:older"),
			requestFn("request:b1", "line:water", "owner:b"),
			requestFn("request:a2", "line:water"),
		];
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareQueueFx(queue, [
					itemFn("owner:b", "forge", boardFn(4)),
					itemFn("source:water", "water", boardFn(2)),
				]);
				return yield* advanceRuntimeStepFx(prepared);
			}).pipe(
				useGameFx({
					config: queueConfig,
				}),
			),
		);

		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual(queue);
		expect(result.runtime.items.find((item) => item.id === "source:water")).toMatchObject({
			location: {
				scope: "delivery",
				phase: "outbound",
				target: {
					ownerItemId: "owner:b",
					lineId: "line:water",
				},
			},
		});
	});

	it("re-evaluates A2 after B1 spends the shared unit budget", () => {
		const config = createContendedQueueConfigFn();
		const queue = [
			requestFn("request:a1", "line:older"),
			requestFn("request:b1", "line:later", "owner:b"),
			requestFn("request:a2", "line:later"),
		];
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareQueueFx(queue, [
					itemFn("owner:b", "forge", boardFn(2)),
				]);
				const before = {
					...prepared,
					items: [
						...prepared.items.map((item) => ({
							...item,
							item: config.items[item.item.uid]!,
						})),
						{
							...itemFn("payer", "water", boardFn(1)),
							item: config.items.payer!,
						},
					],
				};
				const step = yield* advanceRuntimeStepFx(before);
				return {
					runtime: step.runtime,
					events: yield* projectCommittedEngineFactsFx({
						previousRuntime: before,
						runtime: step.runtime,
						facts: step.facts,
					}),
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.jobs).toMatchObject([
			{
				ownerItemId: "owner:b",
				lineId: "line:later",
				remainingMs: 900,
			},
		]);
		expect(result.runtime.jobQueue).toEqual([
			queue[0],
			queue[2],
		]);
		expect(result.events.filter((event) => event.type === "job:started")).toHaveLength(1);
		expect(result.runtime.items.find((item) => item.id === "payer")).toMatchObject({
			remainingUnits: 1,
		});
	});
});
