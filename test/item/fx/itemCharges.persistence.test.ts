import { describe } from "vitest";
import {
	Effect,
	ItemChargesIssueReasonEnumSchema,
	board,
	chargesConfig,
	checkRuntimeFx,
	expect,
	fromRuntimeFn,
	fromStateFx,
	it,
	readRuntimeFx,
	run,
	spawnItemFx,
	startLineFx,
} from "./itemCharges.test/fixture";

describe("item charges / persistence", () => {
	it("persists partial charges and restores a fresh runtime identity state", () => {
		const result = run(
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
			result.state.items.find((item) => item.id === "runtime:shrine")?.remainingCharges,
		).toBe(1);
		expect(
			result.restored.items.find((item) => item.id === "runtime:shrine")?.remainingCharges,
		).toBe(1);
		expect(
			result.restored.items.find((item) => item.id === "runtime:shrine")?.revision,
		).not.toBe(result.runtime.items.find((item) => item.id === "runtime:shrine")?.revision);
	});
	it("reports non-canonical persisted charge states", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				{
					id: "runtime:missing-config",
					item: chargesConfig.items["producer:lumberjack"],
					location: board(0),
					quantity: 1,
					remainingCharges: 1,
					revision: "revision:missing-config",
				},
				{
					id: "runtime:full-state",
					item: chargesConfig.items["producer:shrine"],
					location: board(1),
					quantity: 1,
					remainingCharges: 2,
					revision: "revision:full-state",
				},
				{
					id: "runtime:exceeds",
					item: chargesConfig.items["producer:shrine"],
					location: board(2),
					quantity: 1,
					remainingCharges: 3,
					revision: "revision:exceeds",
				},
				{
					id: "runtime:depleted",
					item: chargesConfig.items["producer:shrine"],
					location: board(3),
					quantity: 1,
					remainingCharges: 0,
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
					reason: ItemChargesIssueReasonEnumSchema.enum.MissingConfig,
				}),
				expect.objectContaining({
					itemId: "runtime:full-state",
					reason: ItemChargesIssueReasonEnumSchema.enum.FullState,
				}),
				expect.objectContaining({
					itemId: "runtime:exceeds",
					reason: ItemChargesIssueReasonEnumSchema.enum.ExceedsAmount,
				}),
				expect.objectContaining({
					itemId: "runtime:depleted",
					reason: ItemChargesIssueReasonEnumSchema.enum.DepletedIdle,
				}),
			]),
		);
	});
});
