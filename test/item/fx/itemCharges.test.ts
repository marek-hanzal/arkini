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
} from "./itemCharges.test/fixture";

describe("item charges / owner lifecycle", () => {
	it("subtracts a self deposit charge and removes the deposit after its final job", () => {
		const result = run(
			Effect.gen(function* () {
				const well = yield* spawnItemFx({
					id: "runtime:self-well",
					itemId: "deposit:self-well",
					location: board(0),
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: well.id,
					lineId: "line:self-well:water",
				});
				const firstStart = yield* (yield* CommittedTransitionsFx).read;
				expect(
					(yield* readRuntimeFx()).items.find((item) => item.id === well.id)
						?.remainingCharges,
				).toBe(1);
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				yield* startLineFx({
					ownerItemId: well.id,
					lineId: "line:self-well:water",
				});
				expect(
					(yield* readRuntimeFx()).items.find((item) => item.id === well.id)
						?.remainingCharges,
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
			type: GameEventEnumSchema.enum.ItemChargeSpent,
			itemId: result.well.id,
			canonicalItemId: "deposit:self-well",
			location: board(0),
			previousCharges: 2,
			resultingCharges: 1,
		});
		expect(result.finalCompletion.events).toContainEqual({
			type: GameEventEnumSchema.enum.ItemDepleted,
			itemId: result.well.id,
			canonicalItemId: "deposit:self-well",
			location: board(0),
			previousQuantity: 1,
			resultingQuantity: 0,
		});
		expect(result.runtime.items.some((item) => item.id === result.well.id)).toBe(false);
		expect(result.runtime.items.filter((item) => item.item.id === "item:gift")).toHaveLength(2);
	});
	it("keeps a limited producer after a partial spend and removes it after its last job", () => {
		const runtime = run(
			Effect.gen(function* () {
				const shrine = yield* spawnItemFx({
					id: "runtime:shrine",
					itemId: "producer:shrine",
					location: board(0),
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: shrine.id,
					lineId: "line:shrine:pray",
				});
				const firstStart = yield* (yield* CommittedTransitionsFx).read;
				let current = yield* readRuntimeFx();
				expect(current.items.find((item) => item.id === shrine.id)?.remainingCharges).toBe(
					1,
				);
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				yield* startLineFx({
					ownerItemId: shrine.id,
					lineId: "line:shrine:pray",
				});
				const finalStart = yield* (yield* CommittedTransitionsFx).read;
				current = yield* readRuntimeFx();
				expect(current.items.find((item) => item.id === shrine.id)?.remainingCharges).toBe(
					0,
				);
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
			type: GameEventEnumSchema.enum.ItemChargeSpent,
			itemId: "runtime:shrine",
			canonicalItemId: "producer:shrine",
			location: board(0),
			previousCharges: 2,
			resultingCharges: 1,
		});
		expect(
			runtime.finalStart.events.some(
				(event) =>
					event.type === GameEventEnumSchema.enum.ItemChargeSpent ||
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
				(event) => event.type === GameEventEnumSchema.enum.ItemChargeSpent,
			),
		).toBe(false);
		expect(runtime.runtime.items.some((item) => item.id === "runtime:shrine")).toBe(false);
		expect(runtime.runtime.items.filter((item) => item.item.id === "item:gift")).toHaveLength(
			2,
		);
		expect(runtime.runtime.items.filter((item) => item.item.id === "item:dust")).toHaveLength(
			1,
		);
	});
	it("isolates one partially spent target from a pure charged stack", () => {
		const runtime = run(
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
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:lumberjack:work",
				});
				return {
					runtime: yield* readRuntimeFx(),
					tree,
				};
			}),
		);

		const trees = runtime.runtime.items.filter((item) => item.item.id === "deposit:tree");
		expect(trees).toHaveLength(2);
		expect(trees.find((item) => item.id === runtime.tree.id)).toMatchObject({
			quantity: 1,
			remainingCharges: 1,
		});
		expect(trees.find((item) => item.id !== runtime.tree.id)).toMatchObject({
			quantity: 1,
			remainingCharges: undefined,
		});
	});
});
