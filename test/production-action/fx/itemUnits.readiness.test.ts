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
} from "./itemUnits.test/fixture";

describe("item units / readiness and selection", () => {
	it("keeps a line unready when aggregate self costs exceed remaining units", () => {
		const resolution = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:overdrawn",
					itemUid: "producer:overdrawn",
					location: board(0),
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
	it("aggregates repeated costs for one target before spending its units", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:double-target",
					itemUid: "producer:double-target",
					location: board(0),
				});
				const tree = yield* spawnItemFx({
					id: "runtime:tree",
					itemUid: "units:tree",
					location: board(1),
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

		expect(result.runtime.items.some((item) => item.id === result.tree.id)).toBe(false);
		expect(result.runtime.jobs).toHaveLength(1);
	});
	it("reserves target units across inputs and selects the next eligible target", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:double-target",
					itemUid: "producer:double-target",
					location: board(0),
				});
				yield* spawnItemFx({
					id: "runtime:sapling:a",
					itemUid: "units:sapling",
					location: board(1),
				});
				yield* spawnItemFx({
					id: "runtime:sapling:b",
					itemUid: "units:sapling",
					location: board(0, 1),
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:double-target:saplings",
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.uid === "units:sapling")).toBe(false);
		expect(runtime.items.filter((item) => item.item.uid === "item:seed")).toHaveLength(2);
	});
});
