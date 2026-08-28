import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { completeJobRuntimeForTestFx } from "~test/job/support/completeJobRuntimeForTestFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import {
	runBlueprint,
	spawnBlueprintFx,
} from "~test/job/fx/completeJobTransitionFx.blueprint.test/fixture";

describe("blueprint completion lifecycle", () => {
	it("rejects a job when any quantity in its random range can exceed maxCount", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:range",
					space: 0,
					itemId: "blueprint:range",
					x: 0,
					y: 0,
				});
				const started = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:range",
				}).pipe(Effect.result);
				return {
					started,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(Result.isFailure(result.started)).toBe(true);
		if (Result.isFailure(result.started)) {
			expect(result.started.failure).toMatchObject({
				_tag: "OutputCapacityError",
				itemId: "item:limited",
				reservedQuantity: 5,
				maxCount: 4,
			});
		}
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items.some((item) => item.item.id === "blueprint:range")).toBe(true);
	});

	it("round-trips an active blueprint job through persisted state", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:plain",
					x: 0,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:plain",
				});
				const runtime = yield* readRuntimeFx();
				const state = yield* fromRuntimeFx({
					runtime,
				});
				return {
					runtime,
					state,
					restored: yield* fromStateFx({
						state,
					}),
				};
			}),
		);

		expect(result.restored.jobs).toEqual(result.runtime.jobs);
		expect(result.restored.jobQueue).toEqual(result.runtime.jobQueue);
		expect(result.restored.items.map((item) => item.location)).toEqual(
			result.runtime.items.map((item) => item.location),
		);
		expect(result.state.jobs).toHaveLength(1);
	});

	it("rejects depleting a blueprint with queued work instead of canceling it", () => {
		const result = runBlueprint(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:plain",
					x: 0,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:plain",
				});
				const started = yield* readRuntimeFx();
				const job = started.jobs[0];
				const ready = {
					...started,
					jobs: [
						{
							...job,
							remainingMs: 0,
						},
					],
					jobQueue: [
						{
							id: "request:stale",
							ownerItemId: owner.id,
							lineId: "line:blueprint:plain",
						},
					],
				};
				return {
					completion: yield* Effect.result(
						completeJobRuntimeForTestFx({
							jobId: job.id,
							runtime: ready,
						}),
					),
					ready,
				};
			}),
		);

		expect(Result.isFailure(result.completion)).toBe(true);
		if (Result.isFailure(result.completion)) {
			expect(result.completion.failure).toMatchObject({
				_tag: "JobOwnerBusyError",
				ownerItemId: "runtime:blueprint",
				jobIds: [],
				requestIds: [
					"request:stale",
				],
			});
		}
		expect(result.ready.jobQueue).toEqual([
			expect.objectContaining({
				id: "request:stale",
			}),
		]);
		expect(result.ready.items.some((item) => item.id === "runtime:blueprint")).toBe(true);
	});
});
