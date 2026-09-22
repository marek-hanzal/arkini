import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { activateItemActionFx } from "~/item-action/fx/activateItemActionFx";
import { activateItemActionWithTransitionFx } from "~/item-action/fx/activateItemActionFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { board, run, spawnAndActivate } from "../support/spaceActionFixture";

describe("Space item unit settlement", () => {
	it("treats activation of the current space as an event-free same-runtime no-op", () => {
		const result = run(
			Effect.gen(function* () {
				const portal = yield* spawnItemFx({
					id: "runtime:same-space",
					itemId: "sameSpacePortal",
					location: board(0),
				});
				const before = yield* readRuntimeFx();
				const activation = yield* activateItemActionWithTransitionFx({
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

		expect(result.activation).toMatchObject({
			result: {
				type: "space",
				space: 0,
			},
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
					location: board(0),
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
		const passiveItem = run(
			spawnAndActivate({
				id: "runtime:spent-item",
				itemId: "spentPortal",
				location: board(2),
			}),
		);
		const items = passiveItem.runtime.items.filter((item) => item.item.id === "spentPortal");
		expect(items).toEqual([
			expect.objectContaining({
				id: passiveItem.item.id,
				location: board(2),

				remainingUnits: undefined,
			}),
		]);
		const spentPassiveItem = run(
			spawnAndActivate({
				id: "runtime:spent-passive-item",
				itemId: "passiveFinitePortal",
				location: board(2),
			}),
		);
		const spentItems = spentPassiveItem.runtime.items.filter(
			(item) => item.item.id === "passiveFinitePortal",
		);
		expect(spentItems).toHaveLength(1);
		expect(spentItems.find((item) => item.id === spentPassiveItem.item.id)).toMatchObject({
			remainingUnits: 1,
		});

		const authored = run(
			Effect.gen(function* () {
				const transitions = yield* CommittedTransitionsFx;
				const portal = yield* spawnItemFx({
					id: "runtime:cumulative",
					itemId: "cumulativePortal",
					location: board(0),
				});
				const before = yield* readRuntimeFx();
				const activation = yield* activateItemActionWithTransitionFx({
					currentSpace: before.currentSpace,
					itemId: portal.id,
					location: portal.location,
					revision: portal.revision,
				});
				const after = yield* readRuntimeFx();
				yield* spawnItemFx({
					id: "runtime:later-commit",
					itemId: "token",
					location: board(3),
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
			"item:disappeared",
			"item:removed",
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
					location: board(0),
				});
				for (let y = 0; y < 2; y++) {
					for (let x = 0; x < 4; x++) {
						if (x === 0 && y === 0) continue;
						yield* spawnItemFx({
							id: `runtime:board-blocker:${x}:${y}`,
							itemId: "permit",
							location: board(x, y),
						});
					}
				}
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					activateItemActionFx({
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
