import { describe } from "vitest";
import {
	Effect,
	board,
	expect,
	it,
	readLineRunFx,
	readRuntimeFx,
	run,
	spawnItemFx,
	startLineFx,
} from "./itemCharges.test/fixture";

describe("item charges / readiness and selection", () => {
	it("keeps a line unready when aggregate self costs exceed remaining charges", () => {
		const resolution = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:overdrawn",
					itemId: "producer:overdrawn",
					location: board(0),
					quantity: 1,
				});
				return yield* readLineRunFx({
					ownerItemId: owner.id,
					lineId: "line:overdrawn:work",
				});
			}),
		);

		expect(resolution.ready).toBe(false);
		expect(resolution.input[0].resolution.ready).toBe(true);
		expect(resolution.input[1].resolution.ready).toBe(false);
		expect(resolution.plan).toBeUndefined();
	});
	it("aggregates repeated costs for one target before spending its charges", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:double-target",
					itemId: "producer:double-target",
					location: board(0),
					quantity: 1,
				});
				const tree = yield* spawnItemFx({
					id: "runtime:tree-stack",
					itemId: "deposit:tree",
					location: board(1),
					quantity: 2,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:double-target:work",
				});
				return {
					runtime: yield* readRuntimeFx(),
					tree,
				};
			}),
		);

		expect(result.runtime.items.filter((item) => item.item.id === "deposit:tree")).toEqual([
			expect.objectContaining({
				id: result.tree.id,
				location: board(1),
				quantity: 1,
				remainingCharges: undefined,
			}),
		]);
	});
	it("reserves target charges across inputs and selects the next eligible target", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:double-target",
					itemId: "producer:double-target",
					location: board(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:sapling:a",
					itemId: "deposit:sapling",
					location: board(1),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:sapling:b",
					itemId: "deposit:sapling",
					location: board(0, 1),
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:double-target:saplings",
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.id === "deposit:sapling")).toBe(false);
		expect(runtime.items.filter((item) => item.item.id === "item:seed")).toHaveLength(2);
	});
});
