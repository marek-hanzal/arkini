import { describe } from "vitest";
import {
	Effect,
	ItemUnitsIssueReasonEnumSchema,
	board,
	unitsConfig,
	checkRuntimeFx,
	expect,
	fromRuntimeFn,
	fromStateFx,
	it,
	readRuntimeFx,
	run,
	spawnItemFx,
	startLineFx,
} from "./itemUnits.test/fixture";

describe("item units / persistence", () => {
	it("persists partial units and restores a fresh runtime identity state", () => {
		const result = run(
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
				const runtime = yield* readRuntimeFx();
				const state = fromRuntimeFn({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					restored,
					runtime,
					state,
				};
			}),
		);

		expect(
			result.state.items.find((item) => item.id === "runtime:shrine")?.remainingUnits,
		).toBe(1);
		expect(
			result.restored.items.find((item) => item.id === "runtime:shrine")?.remainingUnits,
		).toBe(1);
		expect(
			result.restored.items.find((item) => item.id === "runtime:shrine")?.revision,
		).not.toBe(result.runtime.items.find((item) => item.id === "runtime:shrine")?.revision);
	});
	it("reports non-canonical persisted unit states", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
			items: [
				{
					id: "runtime:missing-config",
					item: unitsConfig.items["producer:lumberjack"],
					location: board(0),

					remainingUnits: 1,
					revision: "revision:missing-config",
				},
				{
					id: "runtime:full-state",
					item: unitsConfig.items["producer:shrine"],
					location: board(1),

					remainingUnits: 2,
					revision: "revision:full-state",
				},
				{
					id: "runtime:exceeds",
					item: unitsConfig.items["producer:shrine"],
					location: board(2),

					remainingUnits: 3,
					revision: "revision:exceeds",
				},
				{
					id: "runtime:depleted",
					item: unitsConfig.items["producer:shrine"],
					location: board(3),

					remainingUnits: 0,
					revision: "revision:depleted",
				},
			],
			jobs: [],

			jobQueue: [],
			defaultLineByOwnerItemId: {},
		};
		const result = run(
			checkRuntimeFx({
				runtime,
			}),
		);

		expect(result.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "runtime:missing-config",
					reason: ItemUnitsIssueReasonEnumSchema.enum.MissingConfig,
				}),
				expect.objectContaining({
					itemId: "runtime:full-state",
					reason: ItemUnitsIssueReasonEnumSchema.enum.FullState,
				}),
				expect.objectContaining({
					itemId: "runtime:exceeds",
					reason: ItemUnitsIssueReasonEnumSchema.enum.ExceedsAmount,
				}),
			]),
		);
		expect(
			result.issues.some(
				(issue) => issue.type === "item:units" && issue.itemId === "runtime:depleted",
			),
		).toBe(false);
	});
});
