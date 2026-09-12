import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { activateSpaceItemFx } from "~/space-action/fx/activateSpaceItemFx";
import { activateSpaceItemWithTransitionFx } from "~/space-action/fx/activateSpaceItemFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { board, inventory, run, spawnAndActivate } from "../support/spaceActionFixture";

describe("Space item unit settlement", () => {
	it("treats activation of the current space as an event-free same-runtime no-op", () => {
		const result = run(
			Effect.gen(function* () {
				const portal = yield* spawnItemFx({
					id: "runtime:same-space",
					itemId: "sameSpacePortal",
					location: inventory(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const activation = yield* activateSpaceItemWithTransitionFx({
					currentSpace: before.currentSpace,
					itemId: portal.id,
					location: portal.location,
					revision: portal.revision,
				});
				return {
					after: yield* readRuntimeFx(),
					activation,
					before,
				};
			}),
		);

		expect(result.activation).toEqual({
			result: 0,
			transition: null,
		});
		expect(result.after).toBe(result.before);
	});

	it("spends only authored Action input units and reserves self costs cumulatively", () => {
		const success = run(
			Effect.gen(function* () {
				yield* spawnAndActivate({
					id: "runtime:space-four-navigator",
					itemId: "spentPortal",
					location: inventory(0),
				});
				return yield* spawnAndActivate({
					id: "runtime:spent",
					itemId: "spentPortal",
					location: board(0, 0, 4),
				});
			}),
		);
		expect(success.runtime.currentSpace).toBe(4);
		expect(success.runtime.items.find((item) => item.id === success.item.id)).toMatchObject({
			remainingUnits: undefined,
		});
		const passiveStack = run(
			spawnAndActivate({
				id: "runtime:spent-stack",
				itemId: "spentPortal",
				location: inventory(2),
				quantity: 2,
			}),
		);
		const stackItems = passiveStack.runtime.items.filter(
			(item) => item.item.id === "spentPortal",
		);
		expect(stackItems).toEqual([
			expect.objectContaining({
				id: passiveStack.item.id,
				location: inventory(2),
				quantity: 2,
				remainingUnits: undefined,
			}),
		]);
		const spentPassiveStack = run(
			spawnAndActivate({
				id: "runtime:spent-passive-stack",
				itemId: "passiveFinitePortal",
				location: inventory(2),
				quantity: 2,
			}),
		);
		const spentStackItems = spentPassiveStack.runtime.items.filter(
			(item) => item.item.id === "passiveFinitePortal",
		);
		expect(spentStackItems).toHaveLength(2);
		expect(spentStackItems.find((item) => item.id === spentPassiveStack.item.id)).toMatchObject(
			{
				quantity: 1,
				remainingUnits: 1,
			},
		);
		expect(spentStackItems.find((item) => item.id !== spentPassiveStack.item.id)).toMatchObject(
			{
				location: inventory(1),
				quantity: 1,
				remainingUnits: undefined,
			},
		);

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
				yield* spawnItemFx({
					id: "runtime:later-commit",
					itemId: "token",
					location: inventory(3),
					quantity: 1,
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

	it("commits final-unit depletion output with navigation or rolls all of it back", () => {
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
