import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import {
	runCraft,
	spawnCraftFx,
} from "~test/production-job/fx/completeJobTransitionFx.craft.test/fixture";

describe("craft job completion transition", () => {
	it("consumes the craft, places ordinary outcome on its freed origin, then returns reservations", () => {
		const runtime = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemUid: "craft:reserve",
				});
				const tool = yield* spawnItemFx({
					id: "runtime:tool",
					itemUid: "item:tool",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				});
				yield* bufferInputMaterialForTestFx({
					ownerItemId: owner.id,
					lineUid: "line:craft:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineUid: "line:craft:reserve",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.jobs).toEqual([]);
		expect(runtime.items.some((item) => item.item.uid === "craft:reserve")).toBe(false);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						uid: "item:product",
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
				expect.objectContaining({
					item: expect.objectContaining({
						uid: "item:tool",
					}),
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				}),
			]),
		);
		expect(
			runtime.items.some(
				(item) => item.location.scope === "job" || item.location.scope === "reserved",
			),
		).toBe(false);
	});

	it("removes the depleted craft first and places ordered outcome from the freed origin", () => {
		const runtime = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemUid: "craft:ordered-outcome",
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineUid: "line:craft:ordered-outcome",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.uid === "craft:ordered-outcome")).toBe(false);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						uid: "item:bonus",
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
				expect.objectContaining({
					item: expect.objectContaining({
						uid: "item:result",
					}),
				}),
			]),
		);
	});

	it("supports a craft sink that consumes itself without outcome", () => {
		const runtime = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemUid: "craft:sink",
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineUid: "line:craft:sink",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items).toEqual([]);
		expect(runtime.jobs).toEqual([]);
	});
});
