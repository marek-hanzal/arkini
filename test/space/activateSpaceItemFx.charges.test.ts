import { Result } from "effect";
import { describe, expect, it } from "vitest";

import {
	Effect,
	activateSpaceItemFx,
	board,
	inventory,
	readRuntimeFx,
	run,
	setCurrentSpaceFx,
	spawnAndActivate,
	spawnItemFx,
} from "./activateSpaceItemFx.test/fixture";

describe("Space item charge settlement", () => {
	it("spends own charge on same-target activation and reserves self costs cumulatively", () => {
		const success = run(
			Effect.gen(function* () {
				yield* setCurrentSpaceFx({
					space: 4,
				});
				return yield* spawnAndActivate({
					id: "runtime:charged",
					itemId: "chargedPortal",
					location: board(0, 0, 4),
				});
			}),
		);
		expect(success.runtime.currentSpace).toBe(4);
		expect(success.runtime.items.find((item) => item.id === success.item.id)).toMatchObject({
			remainingCharges: 1,
		});
		const passiveStack = run(
			spawnAndActivate({
				id: "runtime:charged-stack",
				itemId: "chargedPortal",
				location: inventory(2),
				quantity: 2,
			}),
		);
		const stackItems = passiveStack.runtime.items.filter(
			(item) => item.item.id === "chargedPortal",
		);
		expect(stackItems).toHaveLength(2);
		expect(stackItems.find((item) => item.id === passiveStack.item.id)).toMatchObject({
			quantity: 1,
			remainingCharges: 1,
		});
		expect(stackItems.find((item) => item.id !== passiveStack.item.id)).toMatchObject({
			location: inventory(1),
			quantity: 1,
			remainingCharges: undefined,
		});

		const rejected = run(
			Effect.gen(function* () {
				const portal = yield* spawnItemFx({
					id: "runtime:cumulative",
					itemId: "cumulativePortal",
					location: board(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					activateSpaceItemFx({
						currentSpace: before.currentSpace,
						itemId: portal.id,
						location: portal.location,
						revision: portal.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);
		expect(Result.isFailure(rejected.attempt)).toBe(true);
		expect(rejected.after).toEqual(rejected.before);
	});

	it("commits final-charge depletion output with navigation or rolls all of it back", () => {
		const success = run(
			spawnAndActivate({
				id: "runtime:depleting",
				itemId: "depletingPortal",
				location: board(0),
			}),
		);
		expect(success.runtime.currentSpace).toBe(6);
		expect(success.runtime.items.some((item) => item.id === success.item.id)).toBe(false);
		expect(success.runtime.items).toContainEqual(
			expect.objectContaining({
				item: expect.objectContaining({
					id: "token",
				}),
			}),
		);

		const rejected = run(
			Effect.gen(function* () {
				const portal = yield* spawnItemFx({
					id: "runtime:passive-failure",
					itemId: "passiveFailurePortal",
					location: inventory(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					activateSpaceItemFx({
						currentSpace: before.currentSpace,
						itemId: portal.id,
						location: portal.location,
						revision: portal.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}),
		);
		expect(Result.isFailure(rejected.attempt)).toBe(true);
		expect(rejected.after).toEqual(rejected.before);
	});
});
