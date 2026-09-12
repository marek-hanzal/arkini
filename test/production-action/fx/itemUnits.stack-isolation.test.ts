import { describe } from "vitest";
import {
	Effect,
	GameEventEnumSchema,
	board,
	expect,
	it,
	readRuntimeFx,
	run,
	spawnItemFx,
	startLineFx,
	startLineRuntimeFx,
} from "./itemUnits.test/fixture";

describe("item units / stack isolation", () => {
	it("reports an exact split when one spent stack identity becomes stateful", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				const tree = yield* spawnItemFx({
					id: "runtime:tree",
					itemId: "units:tree",
					location: board(1),
					quantity: 2,
				});
				const [, runtime, events] = yield* startLineRuntimeFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:work",
					runtime: yield* readRuntimeFx(),
				});
				return {
					events,
					runtime,
					tree,
				};
			}),
		);

		const unitSpentIndex = result.events.findIndex(
			(event) => event.type === GameEventEnumSchema.enum.ItemUnitSpent,
		);
		const splitIndex = result.events.findIndex(
			(event) => event.type === GameEventEnumSchema.enum.ItemSplit,
		);
		expect(result.events[unitSpentIndex]).toEqual({
			type: GameEventEnumSchema.enum.ItemUnitSpent,
			itemId: result.tree.id,
			canonicalItemId: "units:tree",
			location: board(1),
			previousUnits: 2,
			resultingUnits: 1,
		});
		expect(unitSpentIndex).toBeGreaterThanOrEqual(0);
		expect(splitIndex).toBeGreaterThan(unitSpentIndex);
		expect(result.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemSplit,
			itemId: result.tree.id,
			canonicalItemId: "units:tree",
			location: board(1),
			previousQuantity: 2,
			quantity: 1,
		});
		expect(result.runtime.items.filter((item) => item.item.id === "units:tree")).toHaveLength(
			2,
		);
	});
	it("consumes one fully depleted quantity without relocating the pure remainder", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				const sapling = yield* spawnItemFx({
					id: "runtime:sapling",
					itemId: "units:sapling",
					location: board(1),
					quantity: 2,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:sapling",
				});
				return {
					runtime: yield* readRuntimeFx(),
					sapling,
				};
			}),
		);

		expect(result.runtime.items.find((item) => item.id === result.sapling.id)).toMatchObject({
			quantity: 1,
			location: board(1),
			remainingUnits: undefined,
		});
		expect(
			result.runtime.items.filter((item) => item.item.id === "units:sapling"),
		).toHaveLength(1);
		expect(result.runtime.items.filter((item) => item.item.id === "item:seed")).toHaveLength(1);
	});
	it("reports quantity-one depletion plus ordinary output without inventing replacement", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				const sapling = yield* spawnItemFx({
					id: "runtime:sapling",
					itemId: "units:sapling",
					location: board(1),
					quantity: 1,
				});
				const [, runtime, events] = yield* startLineRuntimeFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:sapling",
					runtime: yield* readRuntimeFx(),
				});
				const seed = runtime.items.find((item) => item.item.id === "item:seed");
				if (seed === undefined) throw new Error("Expected depletion output seed.");
				return {
					events,
					runtime,
					sapling,
					seed,
				};
			}),
		);

		expect(result.runtime.items.some((item) => item.id === result.sapling.id)).toBe(false);
		expect(
			result.events.some((event) => event.type === GameEventEnumSchema.enum.ItemUnitSpent),
		).toBe(false);
		expect(result.events).toEqual(
			expect.arrayContaining([
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: result.sapling.id,
					canonicalItemId: "units:sapling",
					location: board(1),
					previousQuantity: 1,
					resultingQuantity: 0,
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: result.seed.id,
					canonicalItemId: "item:seed",
					originItemId: result.sapling.id,
					location: result.seed.location,
					quantity: 1,
				},
			]),
		);
	});
});
