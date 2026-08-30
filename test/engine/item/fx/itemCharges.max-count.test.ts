import { describe } from "vitest";
import {
	Effect,
	Result,
	RuntimeCheckIssueEnumSchema,
	StateSchema,
	board,
	chargesConfig,
	checkRuntimeFx,
	expect,
	fromStateFx,
	it,
	readRuntimeFx,
	run,
	spawnItemFx,
	startLineFx,
} from "./itemCharges.test/fixture";
import type { RuntimeSchema } from "./itemCharges.test/fixture";

describe("item charges / max count reservations", () => {
	it("rejects hydrated active-job output reservations that overbook maxCount", () => {
		const state = StateSchema.parse({
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				{
					id: "runtime:capped-shrine",
					itemId: "producer:capped-shrine",
					location: board(0),
					remainingCharges: 0,
					quantity: 1,
				},
			],
			jobs: [
				{
					id: "job:capped-shrine",
					ownerItemId: "runtime:capped-shrine",
					lineId: "line:capped-shrine:work",
					durationMs: 200,
					remainingMs: 200,
				},
			],

			jobQueue: [],
			defaultLineByOwnerItemId: {},
		});
		const result = run(
			Effect.result(
				fromStateFx({
					state,
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: expect.arrayContaining([
						{
							itemId: "item:capped-gift",
							itemIds: [],
							jobIds: [
								"job:capped-shrine",
							],
							liveQuantity: 0,
							reservedQuantity: 2,
							maxCount: 1,
							quantity: 2,
							type: RuntimeCheckIssueEnumSchema.enum.ItemMaxCount,
						},
					]),
				},
			});
		}
	});
	it("does not reserve maxCount for queued requests before dispatch", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				{
					id: "runtime:capped-shrine",
					item: chargesConfig.items["producer:capped-shrine"],
					location: board(0),
					quantity: 1,
					revision: "revision:capped-shrine",
				},
			],
			jobs: [],
			jobQueue: [
				{
					id: "request:capped-shrine",
					ownerItemId: "runtime:capped-shrine",
					lineId: "line:capped-shrine:work",
				},
			],

			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;
		const result = run(
			checkRuntimeFx({
				runtime,
			}),
		);

		expect(
			result.issues.some(
				(issue) => issue.type === RuntimeCheckIssueEnumSchema.enum.ItemMaxCount,
			),
		).toBe(false);
	});
	it("blocks a self-depleting job when line and depletion outputs exceed maxCount together", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:capped-shrine",
					itemId: "producer:capped-shrine",
					location: board(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					startLineFx({
						ownerItemId: owner.id,
						lineId: "line:capped-shrine:work",
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);

		expect(result.attempt).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "OutputCapacityError",
					itemId: "item:capped-gift",
				}),
			),
		);
		expect(result.after).toEqual(result.before);
	});
	it("rejects an external depletion when its immediate output exceeds maxCount", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:capped-lumberjack",
					itemId: "producer:capped-lumberjack",
					location: board(0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:capped-sapling",
					itemId: "deposit:capped-sapling",
					location: board(1),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:capped-seed",
					itemId: "item:capped-seed",
					location: board(2),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					startLineFx({
						ownerItemId: owner.id,
						lineId: "line:capped-lumberjack:work",
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);

		expect(result.attempt).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "OutputCapacityError",
					itemId: "item:capped-seed",
				}),
			),
		);
		expect(result.after).toEqual(result.before);
	});
});
