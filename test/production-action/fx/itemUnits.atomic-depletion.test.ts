import {
	Effect,
	Result,
	board,
	expect,
	it,
	readRuntimeFx,
	run,
	spawnItemFx,
	startLineFx,
} from "./itemUnits.test/fixture";

it("rolls back the whole start when depletion outcome cannot be placed", () => {
	const result = run(
		Effect.gen(function* () {
			const owner = yield* spawnItemFx({
				id: "runtime:lumberjack",
				itemUid: "producer:lumberjack",
				location: board(0),
			});
			yield* spawnItemFx({
				id: "runtime:messy",
				itemUid: "units:messy",
				location: board(1),
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
					itemUid: "item:blocker",
					location,
				});
			}
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

it("resolves idle depletion while preserving the exact owner with remaining units", () => {
	const result = run(
		Effect.gen(function* () {
			const owner = yield* spawnItemFx({
				id: "runtime:mixed-owner",
				itemUid: "producer:mixed-unit",
				location: board(0),
			});
			yield* spawnItemFx({
				id: "runtime:empty-target",
				itemUid: "units:empty",
				location: board(1),
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
					itemUid: "item:blocker",
					location,
				});
			}
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

	const owners = result.runtime.items.filter((item) => item.item.uid === "producer:mixed-unit");
	expect(owners).toHaveLength(1);
	expect(owners.find((item) => item.id === result.owner.id)).toMatchObject({
		remainingUnits: 1,
	});
	expect(result.runtime.items.some((item) => item.item.uid === "units:empty")).toBe(false);
});
