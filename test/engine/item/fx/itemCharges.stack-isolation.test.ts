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
} from "./itemCharges.test/fixture";

describe("item charges / stack isolation", () => {
	it("reports an exact split when one charged stack identity becomes stateful", () => {
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
					itemId: "deposit:tree",
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

		const chargeSpentIndex = result.events.findIndex(
			(event) => event.type === GameEventEnumSchema.enum.ItemChargeSpent,
		);
		const splitIndex = result.events.findIndex(
			(event) => event.type === GameEventEnumSchema.enum.ItemSplit,
		);
		expect(result.events[chargeSpentIndex]).toEqual({
			type: GameEventEnumSchema.enum.ItemChargeSpent,
			itemId: result.tree.id,
			canonicalItemId: "deposit:tree",
			location: board(1),
			previousCharges: 2,
			resultingCharges: 1,
		});
		expect(chargeSpentIndex).toBeGreaterThanOrEqual(0);
		expect(splitIndex).toBeGreaterThan(chargeSpentIndex);
		expect(result.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemSplit,
			itemId: result.tree.id,
			canonicalItemId: "deposit:tree",
			location: board(1),
			previousQuantity: 2,
			quantity: 1,
		});
		expect(result.runtime.items.filter((item) => item.item.id === "deposit:tree")).toHaveLength(
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
					itemId: "deposit:sapling",
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
			remainingCharges: undefined,
		});
		expect(
			result.runtime.items.filter((item) => item.item.id === "deposit:sapling"),
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
					itemId: "deposit:sapling",
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
			result.events.some((event) => event.type === GameEventEnumSchema.enum.ItemChargeSpent),
		).toBe(false);
		expect(result.events).toEqual(
			expect.arrayContaining([
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: result.sapling.id,
					canonicalItemId: "deposit:sapling",
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
