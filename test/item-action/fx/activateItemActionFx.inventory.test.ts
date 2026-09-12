import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { activateItemActionFx } from "~/item-action/fx/activateItemActionFx";
import { readRuntimeItemPrimaryActionFx } from "~/item-interaction/fx/readRuntimeItemPrimaryActionFx";
import { releaseInventoryItemFx } from "~/item-interaction/fx/releaseInventoryItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { configInput, run, sourceLocation } from "~test/item-interaction/support/dropItemFixture";

const config = GameConfigSchema.parse({
	...configInput,
	items: {
		...configInput.items,
		backpack: {
			...configInput.items.backpack,
			maxStackSize: 4,
			units: {
				amount: 3,
			},
			action: {
				type: "inventory",
				input: [
					{
						type: "simple",
						units: {
							from: "self",
							cost: 2,
						},
					},
				],
			},
		},
		blocked: {
			...configInput.items.backpack,
			id: "blocked",
			uid: "blocked",
			action: {
				type: "inventory",
				rules: [
					{
						type: "enable",
						when: [
							{
								type: "exists",
								query: {
									scope: "universe",
									selector: {
										type: "item",
										itemId: "stone",
									},
								},
							},
						],
					},
				],
			},
		},
	},
});
const inventory = {
	scope: "inventory" as const,
	position: {
		x: 0,
		y: 0,
	},
};

describe("Inventory item actions", () => {
	it("settles ordinary self inputs before returning the Inventory action and rejects insufficient units or unavailable rules", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "owner",
					itemId: "backpack",
					location: sourceLocation,
					quantity: 1,
				});
				const action = yield* activateItemActionFx({
					currentSpace: 0,
					itemId: owner.id,
					revision: owner.revision,
					location: owner.location,
				});
				const afterPaid = yield* readRuntimeFx();
				const paidOwner = afterPaid.items.find((item) => item.id === owner.id);
				if (paidOwner === undefined) throw new Error("Expected remaining owner units.");
				const insufficient = yield* Effect.result(
					activateItemActionFx({
						currentSpace: 0,
						itemId: paidOwner.id,
						revision: paidOwner.revision,
						location: sourceLocation,
					}),
				);
				const afterInsufficient = yield* readRuntimeFx();
				const blocked = yield* spawnItemFx({
					id: "blocked",
					itemId: "blocked",
					location: {
						scope: "toolbar",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const beforeRejected = yield* readRuntimeFx();
				const rejected = yield* Effect.result(
					activateItemActionFx({
						currentSpace: 0,
						itemId: blocked.id,
						revision: blocked.revision,
						location: blocked.location,
					}),
				);
				return {
					action,
					afterPaid,
					insufficient,
					afterInsufficient,
					beforeRejected,
					rejected,
					after: yield* readRuntimeFx(),
				};
			}),
			config,
		);
		expect(result.action.type).toBe("inventory");
		expect(Result.isFailure(result.insufficient)).toBe(true);
		expect(result.afterInsufficient).toBe(result.afterPaid);
		expect(result.afterPaid.items.find((item) => item.id === "owner")?.remainingUnits).toBe(1);
		expect(result.afterPaid.currentSpace).toBe(0);
		expect(Result.isFailure(result.rejected)).toBe(true);
		expect(result.after).toBe(result.beforeRejected);
	});
	it("releases an Inventory action item from Inventory without evaluating its blocked action", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "owner",
					itemId: "blocked",
					location: inventory,
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const primary = yield* readRuntimeItemPrimaryActionFx({
					item: owner,
					runtime: before,
				});
				const activation = yield* Effect.result(
					activateItemActionFx({
						currentSpace: 0,
						itemId: owner.id,
						revision: owner.revision,
						location: inventory,
					}),
				);
				yield* releaseInventoryItemFx({
					itemId: owner.id,
					revision: owner.revision,
					location: inventory,
				});
				return {
					primary,
					activation,
					after: yield* readRuntimeFx(),
				};
			}),
			config,
		);
		expect(result.primary).toEqual({
			kind: "none",
		});
		expect(Result.isFailure(result.activation)).toBe(true);
		expect(result.after.items.find((item) => item.id === "owner")?.location).toEqual(
			sourceLocation,
		);
	});
});
