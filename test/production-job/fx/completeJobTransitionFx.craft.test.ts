import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import {
	runCraft,
	spawnCraftFx,
} from "~test/production-job/fx/completeJobTransitionFx.craft.test/fixture";

describe("craft job completion transition", () => {
	it("consumes the craft, places ordinary output on its freed origin, then returns reservations", () => {
		const runtime = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:reserve",
				});
				const tool = yield* spawnItemFx({
					id: "runtime:tool",
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
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.jobs).toEqual([]);
		expect(runtime.items.some((item) => item.item.id === "craft:reserve")).toBe(false);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:product",
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
						id: "item:tool",
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

	it("removes the depleted craft first and places ordered output from the freed origin", () => {
		const runtime = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:ordered-output",
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

		expect(runtime.items.some((item) => item.item.id === "craft:ordered-output")).toBe(false);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
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
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:result",
					}),
				}),
			]),
		);
	});

	it("supports a craft sink that consumes itself without output", () => {
		const runtime = runCraft(
			Effect.gen(function* () {
				const owner = yield* spawnCraftFx({
					itemId: "craft:sink",
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:sink",
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
