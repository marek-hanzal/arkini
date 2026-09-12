import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { readReservedJobOutputQuantitiesFn } from "~/production-job/fn/readReservedJobOutputQuantitiesFn";
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
		const buffer = bufferFn(1);
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
				// Deliver the missing buffered unit while the younger job is still active.
				let draft = {
					...active.runtime,
					items: active.runtime.items.map((item) =>
						item.id === buffer.id ? bufferFn(2) : item,
					),
				};
				for (let step = 0; step < 8; step += 1) {
					draft = (yield* advanceRuntimeStepFx(draft)).runtime;
				}
				return {
					bypassed,
					active,
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
		expect(result.bypassed.events).toMatchObject([
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
		expect(result.active.events).toEqual([]);
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
			quantity: 2,
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
			quantity: 1,
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

	it.each([
		"units",
		"output",
	] as const)("re-evaluates A2 after B1 spends the shared %s budget", (budget) => {
		const config = createContendedQueueConfigFn(budget);
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
				return yield* advanceRuntimeStepFx({
					...prepared,
					items: [
						...prepared.items.map((item) => ({
							...item,
							item: config.items[item.item.id]!,
						})),
						{
							...itemFn("payer", "water", boardFn(1)),
							item: config.items.payer!,
						},
					],
				});
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
		if (budget === "units") {
			expect(result.runtime.items.find((item) => item.id === "payer")).toMatchObject({
				remainingUnits: 1,
			});
		} else {
			expect(
				readReservedJobOutputQuantitiesFn({
					runtime: result.runtime,
				}).get("result"),
			).toEqual({
				quantity: 1,
				jobIds: [
					result.runtime.jobs[0]?.id,
				],
			});
		}
	});

	it("does not dispatch any pending request for a stored owner", () => {
		const queue = [
			requestFn("request:older", "line:older"),
			requestFn("request:later", "line:later"),
		];
		const result = Effect.runSync(
			Effect.gen(function* () {
				const prepared = yield* prepareQueueFx(queue, [
					itemFn("source:tool", "tool", boardFn(4), 2),
				]);
				const stored = {
					...prepared,
					items: prepared.items.map((item) =>
						item.id === "owner:a"
							? {
									...item,
									location: {
										scope: "inventory" as const,
										position: {
											x: 0,
											y: 0,
										},
									},
								}
							: item,
					),
				};
				return {
					stored,
					stepped: yield* advanceRuntimeStepFx(stored),
				};
			}).pipe(
				useGameFx({
					config: queueConfig,
				}),
			),
		);

		expect(result.stepped.runtime).toEqual(result.stored);
		expect(result.stepped.events).toEqual([]);
	});
});
