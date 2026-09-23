import { describe } from "vitest";
import {
	Effect,
	GameEventEnumSchema,
	board,
	expect,
	it,
	CommittedTransitionsFx,
	readRuntimeFx,
	run,
	runTickRuntimeByFx,
	spawnItemFx,
	startLineFx,
} from "./itemUnits.test/fixture";

describe("item units / owner lifecycle", () => {
	it("subtracts a self-targeted Producer unit and removes the owner after its final job", () => {
		const result = run(
			Effect.gen(function* () {
				const well = yield* spawnItemFx({
					id: "runtime:self-well",
					itemUid: "units:self-well",
					location: board(0),
				});
				yield* startLineFx({
					ownerItemId: well.id,
					lineUid: "line:self-well:water",
				});
				const firstStart = yield* (yield* CommittedTransitionsFx).read;
				expect(
					(yield* readRuntimeFx()).items.find((item) => item.id === well.id)
						?.remainingUnits,
				).toBe(1);
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				yield* startLineFx({
					ownerItemId: well.id,
					lineUid: "line:self-well:water",
				});
				expect(
					(yield* readRuntimeFx()).items.find((item) => item.id === well.id)
						?.remainingUnits,
				).toBe(0);
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					finalCompletion: yield* (yield* CommittedTransitionsFx).read,
					firstStart,
					runtime: yield* readRuntimeFx(),
					well,
				};
			}),
		);

		expect(result.firstStart.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemUnitSpent,
			itemId: result.well.id,
			itemUid: "units:self-well",
			location: board(0),
			previousUnits: 2,
			resultingUnits: 1,
		});
		expect(result.finalCompletion.events).toContainEqual(
			expect.objectContaining({
				type: GameEventEnumSchema.enum.ItemDepleted,
				itemId: result.well.id,
				itemUid: "units:self-well",
				location: board(0),
			}),
		);
		expect(result.finalCompletion.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemDisappeared,
			itemId: result.well.id,
			itemUid: "units:self-well",
			location: board(0),
		});
		expect(result.runtime.items.some((item) => item.id === result.well.id)).toBe(false);
		expect(result.runtime.items.filter((item) => item.item.uid === "item:gift")).toHaveLength(
			2,
		);
	});
	it("keeps a limited producer after a partial spend and removes it after its last job", () => {
		const runtime = run(
			Effect.gen(function* () {
				const shrine = yield* spawnItemFx({
					id: "runtime:shrine",
					itemUid: "producer:shrine",
					location: board(0),
				});
				yield* startLineFx({
					ownerItemId: shrine.id,
					lineUid: "line:shrine:pray",
				});
				const firstStart = yield* (yield* CommittedTransitionsFx).read;
				let current = yield* readRuntimeFx();
				expect(current.items.find((item) => item.id === shrine.id)?.remainingUnits).toBe(1);
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				yield* startLineFx({
					ownerItemId: shrine.id,
					lineUid: "line:shrine:pray",
				});
				const finalStart = yield* (yield* CommittedTransitionsFx).read;
				current = yield* readRuntimeFx();
				expect(current.items.find((item) => item.id === shrine.id)?.remainingUnits).toBe(0);
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					finalCompletion: yield* (yield* CommittedTransitionsFx).read,
					finalStart,
					firstStart,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(runtime.firstStart.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemUnitSpent,
			itemId: "runtime:shrine",
			itemUid: "producer:shrine",
			location: board(0),
			previousUnits: 2,
			resultingUnits: 1,
		});
		expect(
			runtime.finalStart.events.some(
				(event) =>
					event.type === GameEventEnumSchema.enum.ItemUnitSpent ||
					event.type === GameEventEnumSchema.enum.ItemDepleted,
			),
		).toBe(false);
		expect(
			runtime.finalCompletion.events.filter(
				(event) => event.type === GameEventEnumSchema.enum.ItemDepleted,
			),
		).toHaveLength(1);
		expect(
			runtime.finalCompletion.events.some(
				(event) => event.type === GameEventEnumSchema.enum.ItemDisappeared,
			),
		).toBe(false);
		expect(
			runtime.finalCompletion.events.some(
				(event) => event.type === GameEventEnumSchema.enum.ItemUnitSpent,
			),
		).toBe(false);
		expect(runtime.runtime.items.some((item) => item.id === "runtime:shrine")).toBe(false);
		expect(runtime.runtime.items.filter((item) => item.item.uid === "item:gift")).toHaveLength(
			2,
		);
		expect(runtime.runtime.items.filter((item) => item.item.uid === "item:dust")).toHaveLength(
			1,
		);
	});
});
