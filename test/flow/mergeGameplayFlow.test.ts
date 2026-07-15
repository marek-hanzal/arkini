import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { mergeItemsFx } from "~/v1/merge/write/mergeItemsFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const mergeLiveItemsFx = (sourceItemId: string, targetItemId: string) =>
	Effect.gen(function* () {
		const runtime = yield* readRuntimeFx();
		const source = runtime.items.find((item) => item.id === sourceItemId);
		const target = runtime.items.find((item) => item.id === targetItemId);
		if (source === undefined || target === undefined) {
			return yield* Effect.dieMessage("Expected live authored merge participants.");
		}

		return yield* mergeItemsFx({
			sourceItemId: source.id,
			sourceRevision: source.revision,
			targetItemId: target.id,
			targetRevision: target.revision,
		});
	});

describe("authored directional merge gameplay", () => {
	it("evolves one tree through the authored water chain", async () => {
		const config = await readArkiniGameConfigSource();
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:water",
					itemId: "item:water",
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
				yield* spawnItemFx({
					id: "runtime:tree",
					itemId: "item:tree",
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

				const first = yield* mergeLiveItemsFx("runtime:water", "runtime:tree");
				const afterFirst = yield* readRuntimeFx();
				const firstTarget = afterFirst.items.find((item) => item.id === "runtime:tree");
				const second = yield* mergeLiveItemsFx("runtime:water", "runtime:tree");
				const afterSecond = yield* readRuntimeFx();
				const secondTarget = afterSecond.items.find((item) => item.id === "runtime:tree");
				const third = yield* mergeLiveItemsFx("runtime:water", "runtime:tree");

				return {
					after: yield* readRuntimeFx(),
					first,
					firstTarget,
					second,
					secondTarget,
					third,
				};
			}).pipe(
				useGameFx({
					config,
					state: {
						currentSpace: 0,
						items: [],
						jobs: [],
						jobQueue: [],
					},
				}),
			),
		);

		expect(result.first).toEqual(
			expect.objectContaining({
				action: "consume",
				effect: "replace",
				resultCanonicalItemId: "item:double-tree",
			}),
		);
		expect(result.firstTarget?.item.id).toBe("item:double-tree");
		expect(result.second).toEqual(
			expect.objectContaining({
				action: "consume",
				effect: "replace",
				resultCanonicalItemId: "item:micro-forest",
			}),
		);
		expect(result.secondTarget?.item.id).toBe("item:micro-forest");
		expect(result.third).toEqual(
			expect.objectContaining({
				action: "consume",
				effect: "keep",
			}),
		);
		expect(result.after.items.find((item) => item.id === "runtime:tree")?.item.id).toBe(
			"item:micro-forest",
		);
		expect(result.after.items.some((item) => item.id === "runtime:water")).toBe(false);
	});

	it("harvests authored tree and rock targets with inventory tools", async () => {
		const config = await readArkiniGameConfigSource();
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:axe",
					itemId: "item:axe",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:tree",
					itemId: "item:tree",
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
				yield* spawnItemFx({
					id: "runtime:pickaxe",
					itemId: "item:pickaxe",
					location: {
						scope: "inventory",
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:rock",
					itemId: "item:rock",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 5,
							y: 0,
						},
					},
					quantity: 1,
				});

				const axe = yield* mergeLiveItemsFx("runtime:axe", "runtime:tree");
				const pickaxe = yield* mergeLiveItemsFx("runtime:pickaxe", "runtime:rock");

				return {
					after: yield* readRuntimeFx(),
					axe,
					pickaxe,
				};
			}).pipe(
				useGameFx({
					config,
					state: {
						currentSpace: 0,
						items: [],
						jobs: [],
						jobQueue: [],
					},
				}),
			),
		);

		expect(result.axe).toEqual(
			expect.objectContaining({
				action: "consume",
				effect: "remove",
			}),
		);
		expect(result.pickaxe).toEqual(
			expect.objectContaining({
				action: "consume",
				effect: "remove",
			}),
		);
		expect(
			result.after.items.some(
				(item) =>
					item.id === "runtime:axe" ||
					item.id === "runtime:tree" ||
					item.id === "runtime:pickaxe" ||
					item.id === "runtime:rock",
			),
		).toBe(false);
		expect(
			result.after.items
				.filter((item) => item.item.id === "item:log")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBe(1);
		expect(
			result.after.items
				.filter((item) => item.item.id === "item:stone")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBeGreaterThanOrEqual(1);
		expect(
			result.after.items
				.filter((item) => item.item.id === "item:stone")
				.reduce((quantity, item) => quantity + item.quantity, 0),
		).toBeLessThanOrEqual(4);
	});
});
