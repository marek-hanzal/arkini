import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { activateItemActionFx } from "~/item-action/fx/activateItemActionFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { board, inventory, run, spawnAndActivate, toolbar } from "../support/spaceActionFixture";

describe("Space item activation", () => {
	it("activates from every visible storage scope and round-trips the resulting state", () => {
		for (const [name, location] of [
			[
				"board",
				board(0),
			],
			[
				"toolbar",
				toolbar(0),
			],
		] as const) {
			const result = run(
				Effect.gen(function* () {
					const activated = yield* spawnAndActivate({
						id: `runtime:${name}:portal`,
						itemId: "portal",
						location,
					});
					const state = fromRuntimeFn({
						runtime: activated.runtime,
					});
					const restored = yield* fromStateFx({
						state,
					});
					return {
						...activated,
						state,
						restored,
					};
				}),
			);
			expect(result.space).toMatchObject({
				type: "space",
				space: 7,
			});
			expect(result.runtime.currentSpace).toBe(7);
			expect(result.state.currentSpace).toBe(7);
			expect(result.restored.currentSpace).toBe(7);
			expect(result.restored.items[0]?.item).toMatchObject({
				action: {
					type: "space",
					space: 7,
				},
			});
			expect(result.restored.items[0]?.location.scope).toBe(location.scope);
			if (location.scope === "board") {
				expect(result.state.items[0]?.location).toEqual(location);
				expect(result.restored.items[0]?.location).toEqual(location);
			}
		}
	});

	it("rejects failed availability rules without mutating navigation or the item", () => {
		const result = run(
			Effect.gen(function* () {
				const item = yield* spawnItemFx({
					id: "runtime:blocked",
					itemId: "blockedPortal",
					location: board(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					activateItemActionFx({
						currentSpace: before.currentSpace,
						itemId: item.id,
						location: item.location,
						revision: item.revision,
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
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "ItemActionUnavailableError",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("settles external or owner-paid Board units and never invents a passive origin", () => {
		const boardResult = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:payer:far",
					itemId: "payer",
					location: board(0, 0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:payer:near",
					itemId: "payer",
					location: board(1, 0),
					quantity: 1,
				});
				return yield* spawnAndActivate({
					id: "runtime:units-portal",
					itemId: "unitsPortal",
					location: board(1, 1),
				});
			}),
		);
		expect(boardResult.runtime.currentSpace).toBe(3);
		expect(
			boardResult.runtime.items.find((item) => item.id === "runtime:payer:near"),
		).toMatchObject({
			remainingUnits: 1,
		});
		expect(
			boardResult.runtime.items.find((item) => item.id === "runtime:payer:far"),
		).toMatchObject({
			remainingUnits: undefined,
		});

		const ownerPaid = run(
			Effect.gen(function* () {
				const payer = yield* spawnItemFx({
					id: "runtime:owner-paid-target",
					itemId: "payer",
					location: board(1),
					quantity: 1,
				});
				const activated = yield* spawnAndActivate({
					id: "runtime:owner-paid-portal",
					itemId: "ownerUnitsPortal",
					location: board(0),
				});
				return {
					activated,
					payer,
				};
			}),
		);
		expect(ownerPaid.activated.runtime.currentSpace).toBe(8);
		expect(
			ownerPaid.activated.runtime.items.find(
				(item) => item.id === ownerPaid.activated.item.id,
			),
		).toMatchObject({
			remainingUnits: 2,
		});
		expect(
			ownerPaid.activated.runtime.items.find((item) => item.id === ownerPaid.payer.id),
		).toMatchObject({
			remainingUnits: undefined,
		});

		const passiveResult = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:passive-payer",
					itemId: "payer",
					location: board(0),
					quantity: 1,
				});
				const portal = yield* spawnItemFx({
					id: "runtime:passive-units-portal",
					itemId: "unitsPortal",
					location: inventory(0),
					quantity: 1,
				});
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
		expect(Result.isFailure(passiveResult.attempt)).toBe(true);
		expect(passiveResult.after).toEqual(passiveResult.before);
	});
});
