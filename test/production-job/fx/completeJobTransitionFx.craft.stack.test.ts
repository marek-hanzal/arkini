import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import {
	runCraft,
	spawnCraftFx,
} from "~test/production-job/fx/completeJobTransitionFx.craft.test/fixture";

describe("craft stacked-owner lifecycle", () => {
	it("splits a stacked craft before starting one isolated owner", () => {
		const runtime = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:drop",
					quantity: 3,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:drop",
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				ownerItemId: "runtime:craft:drop",
			}),
		]);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "runtime:craft:drop",
					quantity: 1,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "craft:drop",
					}),
					quantity: 2,
				}),
			]),
		);
		expect(runtime.items.filter((item) => item.item.id === "craft:drop")).toHaveLength(2);
	});

	it("rejects a stacked craft start atomically when its remainder cannot be placed", () => {
		const result = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:drop",
					quantity: 2,
				});
				let blockerIndex = 0;
				for (let y = 0; y < 2; y += 1) {
					for (let x = 0; x < 3; x += 1) {
						if (x === 0 && y === 0) continue;
						yield* spawnItemFx({
							id: `runtime:start-blocker:${blockerIndex}`,
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
					id: "runtime:start-inventory-blocker",
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
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					startLineFx({
						ownerItemId: owner.id,
						lineId: "line:craft:drop",
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("starts another craft from the separated stack while the first craft is running", () => {
		const runtime = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:drop",
					quantity: 3,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:drop",
				});
				const afterFirst = yield* readRuntimeFx();
				const remainder = afterFirst.items.find(
					(item) => item.item.id === "craft:drop" && item.id !== owner.id,
				);
				if (remainder === undefined) throw new Error("Expected separated craft remainder.");
				yield* startLineFx({
					ownerItemId: remainder.id,
					lineId: "line:craft:drop",
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.jobs).toHaveLength(2);
		const runningOwnerIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
		for (const ownerItemId of runningOwnerIds) {
			expect(runtime.items.find((item) => item.id === ownerItemId)?.quantity).toBe(1);
		}
		expect(
			runtime.items.find(
				(item) => item.item.id === "craft:drop" && !runningOwnerIds.has(item.id),
			),
		).toMatchObject({
			quantity: 1,
		});
	});

	it("depletes one isolated craft while its already separated remainder stays available", () => {
		const runtime = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:ordered-output",
					quantity: 3,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:ordered-output",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:result",
					}),
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "craft:ordered-output",
					}),
					quantity: 2,
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:bonus",
					}),
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
			]),
		);
		expect(
			runtime.items.find((item) => item.item.id === "craft:ordered-output")?.location,
		).not.toEqual({
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		});
	});
});
