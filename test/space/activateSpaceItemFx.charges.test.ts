import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { activateSpaceItemWithTransitionFx } from "~/engine/space/write/activateSpaceItemWithTransitionFx";
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
	it("spends only authored Action input charges and reserves self costs cumulatively", () => {
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
			remainingCharges: undefined,
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
		expect(stackItems).toEqual([
			expect.objectContaining({
				id: passiveStack.item.id,
				location: inventory(2),
				quantity: 2,
				remainingCharges: undefined,
			}),
		]);
		const chargedPassiveStack = run(
			spawnAndActivate({
				id: "runtime:charged-passive-stack",
				itemId: "passiveChargedPortal",
				location: inventory(2),
				quantity: 2,
			}),
		);
		const chargedStackItems = chargedPassiveStack.runtime.items.filter(
			(item) => item.item.id === "passiveChargedPortal",
		);
		expect(chargedStackItems).toHaveLength(2);
		expect(
			chargedStackItems.find((item) => item.id === chargedPassiveStack.item.id),
		).toMatchObject({
			quantity: 1,
			remainingCharges: 1,
		});
		expect(
			chargedStackItems.find((item) => item.id !== chargedPassiveStack.item.id),
		).toMatchObject({
			location: inventory(1),
			quantity: 1,
			remainingCharges: undefined,
		});

		const authored = run(
			Effect.gen(function* () {
				const transitions = yield* CommittedTransitionsFx;
				const portal = yield* spawnItemFx({
					id: "runtime:cumulative",
					itemId: "cumulativePortal",
					location: board(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const activation = yield* activateSpaceItemWithTransitionFx({
					currentSpace: before.currentSpace,
					itemId: portal.id,
					location: portal.location,
					revision: portal.revision,
				});
				const after = yield* readRuntimeFx();
				yield* setCurrentSpaceFx({
					space: 10,
				});
				return {
					after,
					latestTransition: yield* transitions.read,
					portal,
					transition: activation.transition,
				};
			}),
		);
		expect(authored.after.currentSpace).toBe(5);
		expect(authored.after.items.some((item) => item.id === authored.portal.id)).toBe(false);
		expect(authored.transition?.events.map((event) => event.type)).toEqual([
			"item:depleted",
			"current-space:changed",
		]);
		expect(authored.transition?.sequence).toBeLessThan(authored.latestTransition.sequence);
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
