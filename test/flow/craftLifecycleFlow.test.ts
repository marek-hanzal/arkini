import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";
import { StartLineResultEnumSchema } from "~/engine/job/schema/StartLineResultEnumSchema";

describe("authored craft lifecycle", () => {
	it("pauses a seed craft in inventory and completes it after returning to the board", async () => {
		const config = await readArkiniGameConfigSource();
		const result = Effect.runSync(
			Effect.gen(function* () {
				const seed = yield* spawnItemFx({
					id: "runtime:authored-seed",
					itemId: "item:seed",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 3,
				});
				const water = yield* spawnItemFx({
					id: "runtime:authored-water",
					itemId: "item:water",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 6,
				});
				yield* storeInputMaterialFx({
					ownerItemId: seed.id,
					lineId: "line:seed:grow",
					inputIndex: 0,
					sourceItemId: water.id,
					sourceItemRevision: water.revision,
					quantity: 6,
				});
				const started = yield* startLineFx({
					ownerItemId: seed.id,
					lineId: "line:seed:grow",
				});
				const secondStart = yield* Effect.either(
					startLineFx({
						ownerItemId: seed.id,
						lineId: "line:seed:grow",
					}),
				);
				yield* runTickRuntimeByFx({
					elapsedMs: 10_000,
				});
				const beforeInventory = yield* readRuntimeFx();
				const liveSeed = beforeInventory.items.find((item) => item.id === seed.id);
				if (liveSeed === undefined) throw new Error("Expected live seed owner.");
				yield* moveItemFx({
					itemId: liveSeed.id,
					revision: liveSeed.revision,
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 5_000,
				});
				const paused = yield* readRuntimeFx();
				const inventorySeed = paused.items.find((item) => item.id === seed.id);
				if (inventorySeed === undefined) throw new Error("Expected paused seed owner.");
				yield* moveItemFx({
					itemId: inventorySeed.id,
					revision: inventorySeed.revision,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 20_000,
				});

				return {
					completed: yield* readRuntimeFx(),
					paused,
					secondStart,
					started,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.started.type).toBe(StartLineResultEnumSchema.enum.Started);
		expect(Either.isLeft(result.secondStart)).toBe(true);
		if (Either.isLeft(result.secondStart)) {
			expect([
				"JobQueueFullError",
				"LineRunUnavailableError",
			]).toContain(result.secondStart.left._tag);
		}
		expect(result.paused.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 20_000,
			}),
		]);
		expect(result.paused.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "runtime:authored-seed",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
			]),
		);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.jobQueue).toEqual([]);
		expect(result.completed.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:seed",
					}),
					quantity: 2,
				}),
			]),
		);
		expect(result.completed.items.some((item) => item.item.id === "item:water")).toBe(false);
		expect(result.completed.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:tree",
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
	});
});
