import { describe } from "vitest";
import {
	Effect,
	GameEventEnumSchema,
	Result,
	board,
	expect,
	it,
	readRuntimeFx,
	run,
	spawnItemFx,
	startLineFx,
	startLineRuntimeFx,
} from "./itemUnits.test/fixture";

describe("item units / atomic depletion", () => {
	it("reports one depleted stack quantity without falsely removing the surviving actor", () => {
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
				const [, runtime, events] = yield* startLineRuntimeFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:sapling",
					runtime: yield* readRuntimeFx(),
				});
				return {
					events,
					runtime,
					sapling,
				};
			}),
		);

		expect(result.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemDepleted,
			itemId: result.sapling.id,
			canonicalItemId: "units:sapling",
			location: board(1),
			previousQuantity: 2,
			resultingQuantity: 1,
		});
		expect(result.runtime.items.find((item) => item.id === result.sapling.id)).toMatchObject({
			quantity: 1,
			location: board(1),
		});
	});
	it("rolls back the whole start when depletion output cannot be placed", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:lumberjack",
					itemId: "producer:lumberjack",
					location: board(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:messy",
					itemId: "units:messy",
					location: board(1),
					quantity: 1,
				});
				for (const [id, location] of [
					[
						"runtime:blocker:2",
						board(2),
					],
					[
						"runtime:blocker:3",
						board(3),
					],
					[
						"runtime:blocker:4",
						board(0, 1),
					],
					[
						"runtime:blocker:5",
						board(1, 1),
					],
					[
						"runtime:blocker:6",
						board(2, 1),
					],
					[
						"runtime:blocker:7",
						board(3, 1),
					],
				] as const) {
					yield* spawnItemFx({
						id,
						itemId: "item:blocker",
						location,
						quantity: 1,
					});
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
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					startLineFx({
						ownerItemId: owner.id,
						lineId: "line:lumberjack:messy",
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
		expect(result.after).toEqual(result.before);
	});
	it("resolves idle depletion before isolating a surviving owner with units", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:mixed-owner",
					itemId: "producer:mixed-unit",
					location: board(0),
					quantity: 2,
				});
				yield* spawnItemFx({
					id: "runtime:empty-target",
					itemId: "units:empty",
					location: board(1),
					quantity: 1,
				});
				for (const [id, location] of [
					[
						"runtime:mixed-blocker:2",
						board(2),
					],
					[
						"runtime:mixed-blocker:3",
						board(3),
					],
					[
						"runtime:mixed-blocker:4",
						board(0, 1),
					],
					[
						"runtime:mixed-blocker:5",
						board(1, 1),
					],
					[
						"runtime:mixed-blocker:6",
						board(2, 1),
					],
					[
						"runtime:mixed-blocker:7",
						board(3, 1),
					],
				] as const) {
					yield* spawnItemFx({
						id,
						itemId: "item:blocker",
						location,
						quantity: 1,
					});
				}
				yield* spawnItemFx({
					id: "runtime:mixed-inventory-blocker",
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
					lineId: "line:mixed-unit:work",
				});
				return {
					owner,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		const owners = result.runtime.items.filter(
			(item) => item.item.id === "producer:mixed-unit",
		);
		expect(owners).toHaveLength(2);
		expect(owners.find((item) => item.id === result.owner.id)).toMatchObject({
			quantity: 1,
			remainingUnits: 1,
		});
		expect(owners.find((item) => item.id !== result.owner.id)).toMatchObject({
			location: board(1),
			quantity: 1,
			remainingUnits: undefined,
		});
		expect(result.runtime.items.some((item) => item.item.id === "units:empty")).toBe(false);
	});
});
