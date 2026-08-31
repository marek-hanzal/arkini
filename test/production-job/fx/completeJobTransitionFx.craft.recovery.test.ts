import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { attemptJobCompletionFx } from "~/production-job/fx/attemptJobCompletionFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { completeJobRuntimeForTestFx } from "~test/production-job/support/completeJobRuntimeForTestFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import {
	projectRandomCraftOutputFx,
	runCraft,
	spawnCraftFx,
} from "~test/production-job/fx/completeJobTransitionFx.craft.test/fixture";

describe("craft completion recovery", () => {
	it("keeps blocked craft completion unchanged and replays one deterministic output", () => {
		const result = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:random",
				});
				let blockerIndex = 0;
				for (let y = 0; y < 2; y += 1) {
					for (let x = 0; x < 3; x += 1) {
						if (x === 0 && y === 0) continue;
						yield* spawnItemFx({
							id: `runtime:blocker:${blockerIndex}`,
							itemId: "item:blocker",
							location: {
								scope: "board",
								space: 0,
								position: {
									x,
									y,
								},
							},
							quantity: 1,
						});
						blockerIndex += 1;
					}
				}
				yield* spawnItemFx({
					id: "runtime:inventory-blocker",
					itemId: "item:blocker",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:random",
				});
				const running = yield* readRuntimeFx();
				const liveJob = running.jobs[0];
				if (liveJob === undefined) throw new Error("Expected craft completion job.");
				const job = {
					...liveJob,
					id: "job:craft:deterministic",
					remainingMs: 0,
				} satisfies JobSchema.Type;
				const fullRuntime = {
					...running,
					jobs: [
						job,
					],
				} satisfies RuntimeSchema.Type;
				const freeRuntime = {
					...fullRuntime,
					items: fullRuntime.items.filter((item) => item.id !== "runtime:blocker:0"),
				} satisfies RuntimeSchema.Type;
				const blocked = yield* attemptJobCompletionFx({
					jobId: job.id,
					runtime: fullRuntime,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.01,
						]),
					),
				);
				const immediate = yield* completeJobRuntimeForTestFx({
					jobId: job.id,
					runtime: freeRuntime,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.01,
						]),
					),
				);
				const retried = yield* completeJobRuntimeForTestFx({
					jobId: job.id,
					runtime: freeRuntime,
				}).pipe(
					Effect.provideServiceEffect(
						Random.Random,
						makeFixedRandomFx([
							0.99,
						]),
					),
				);

				return {
					blocked,
					fullRuntime,
					immediate: yield* projectRandomCraftOutputFx({
						runtime: immediate,
					}),
					retried: yield* projectRandomCraftOutputFx({
						runtime: retried,
					}),
				};
			}),
		);

		expect(result.blocked).toMatchObject({
			type: "blocked",
		});
		if (result.blocked.type === "blocked") {
			expect(result.blocked.runtime).toBe(result.fullRuntime);
			expect(
				result.blocked.runtime.items.some((item) => item.item.id === "craft:random"),
			).toBe(true);
			expect(result.blocked.runtime.jobs).toHaveLength(1);
		}
		expect(result.immediate).not.toEqual([]);
		expect(result.retried).toEqual(result.immediate);
	});

	it("round-trips an active craft job and its reservation through persisted state", () => {
		const result = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:reserve",
				});
				const tool = yield* spawnItemFx({
					id: "runtime:roundtrip-tool",
					itemId: "item:tool",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: "line:craft:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:reserve",
				});
				const runtime = yield* readRuntimeFx();
				const state = fromRuntimeFn({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					restored,
					runtime,
					state,
				};
			}),
		);

		expect(result.restored.jobs).toEqual(result.runtime.jobs);
		expect(result.restored.jobQueue).toEqual(result.runtime.jobQueue);
		expect(result.restored.items.map((item) => item.location)).toEqual(
			result.runtime.items.map((item) => item.location),
		);
		expect(result.state.items.some((item) => item.location.scope === "reserved")).toBe(true);
	});
});
