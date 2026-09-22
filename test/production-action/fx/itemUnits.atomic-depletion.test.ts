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
		expect(
			result.events.some((event) => event.type === GameEventEnumSchema.enum.ItemDisappeared),
		).toBe(false);
		expect(result.runtime.items.find((item) => item.id === result.sapling.id)).toMatchObject({
			quantity: 1,
			location: board(1),
		});
	});
});
