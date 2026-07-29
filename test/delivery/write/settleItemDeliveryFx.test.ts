import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { settleItemDeliveryFx } from "~/engine/delivery/write/settleItemDeliveryFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { getItemFx } from "~/engine/runtime/read/getItemFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";
const workshop = inputRuntimeTestConfig.items.workshop;
if (workshop.type !== "producer") throw new Error("Expected producer test owner.");
const twoMaterialInputConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...workshop,
			lines: workshop.lines.map((line) => ({
				...line,
				input: [
					line.input[0],
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "water",
						},
						quantity: {
							type: "value",
							value: 2,
						},
						capacity: 0,
					},
					...line.input.slice(1),
				],
			})),
		},
	},
});
const rangeMaterialInputConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...workshop,
			lines: workshop.lines.map((line) => ({
				...line,
				input: [
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "water",
						},
						quantity: {
							type: "range",
							min: 1,
							max: 4,
						},
						capacity: 0,
					},
					...line.input.slice(1),
				],
			})),
		},
	},
});
const wideDeliveryConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		water: {
			...inputRuntimeTestConfig.items.water,
			footprint: {
				width: 2,
				height: 2,
			},
		},
	},
});

const spawnOwnerAndWaterFx = Effect.gen(function* () {
	yield* spawnItemFx({
		id: ownerItemId,
		itemId: "workshop",
		location: workshopLocation,
		quantity: 1,
	});
	yield* spawnItemFx({
		id: "runtime:water",
		itemId: "water",
		location: sourceLocation(1),
		quantity: 7,
	});
});

describe("settleItemDeliveryFx", () => {
	it("stores only on outbound contact and returns the whole stack remainder to its lease", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				const autofill = yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const outbound = yield* readRuntimeFx();
				const settled = yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				const afterContact = yield* readRuntimeFx();
				const returningState = yield* fromRuntimeFx({
					runtime: afterContact,
				});
				const hydratedReturning = yield* fromStateFx({
					state: returningState,
				});
				const stale = yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				const returned = yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 1,
				});
				return {
					afterContact,
					autofill,
					hydratedReturning,
					outbound,
					returned,
					returningState,
					settled,
					stale,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.autofill).toEqual({
			deliveryItemIds: [
				"runtime:water",
			],
			remainingMissingQuantity: 0,
			scheduledQuantity: 3,
		});
		expect(result.outbound.items.find(({ id }) => id === "runtime:water")).toMatchObject({
			location: {
				generation: 0,
				origin: sourceLocation(1),
				phase: "outbound",
				scope: "delivery",
			},
			quantity: 7,
		});
		expect(
			result.outbound.items.filter(({ location }) => location.scope === "input"),
		).toHaveLength(0);
		expect(result.settled).toMatchObject({
			acceptedQuantity: 3,
			status: "stored",
		});
		expect(result.afterContact.items.find(({ id }) => id === "runtime:water")).toMatchObject({
			location: {
				generation: 1,
				phase: "returning",
				returnFrom: workshopLocation,
				scope: "delivery",
			},
			quantity: 4,
		});
		expect(
			result.returningState.items.find(({ id }) => id === "runtime:water")?.location,
		).toEqual(result.afterContact.items.find(({ id }) => id === "runtime:water")?.location);
		expect(
			result.hydratedReturning.items.find(({ id }) => id === "runtime:water")?.location,
		).toEqual(result.afterContact.items.find(({ id }) => id === "runtime:water")?.location);
		expect(
			result.afterContact.items
				.filter(({ location }) => location.scope === "input")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(3);
		expect(result.stale).toEqual({
			acceptedQuantity: 0,
			status: "ignored",
		});
		expect(result.returned).toMatchObject({
			status: "returned",
		});
		expect(result.runtime.items.find(({ id }) => id === "runtime:water")).toMatchObject({
			location: sourceLocation(1),
			quantity: 4,
		});
	});

	it("returns a settled stack remainder without stealing another in-flight range claim", () => {
		const inventoryOrigin = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				// Inventory is deliberately earlier in runtime order while Board wins autofill
				// priority. Settling Inventory first reproduces the live presentation race.
				yield* spawnItemFx({
					id: "runtime:inventory-water",
					itemId: "water",
					location: inventoryOrigin,
					quantity: 6,
				});
				yield* spawnItemFx({
					id: "runtime:board-water",
					itemId: "water",
					location: sourceLocation(1),
					quantity: 2,
				});
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				yield* settleItemDeliveryFx({
					itemId: "runtime:inventory-water",
					generation: 0,
				});
				const afterInventoryContact = yield* readRuntimeFx();
				const staleRepeat = yield* settleItemDeliveryFx({
					itemId: "runtime:inventory-water",
					generation: 0,
				});
				yield* settleItemDeliveryFx({
					itemId: "runtime:board-water",
					generation: 0,
				});
				return {
					afterBoardContact: yield* readRuntimeFx(),
					afterInventoryContact,
					staleRepeat,
				};
			}).pipe(
				useGameFx({
					config: rangeMaterialInputConfig,
				}),
			),
		);

		expect(
			result.afterInventoryContact.items.find(({ id }) => id === "runtime:inventory-water"),
		).toMatchObject({
			location: {
				generation: 1,
				origin: inventoryOrigin,
				phase: "returning",
				scope: "delivery",
			},
			quantity: 4,
		});
		expect(
			result.afterInventoryContact.items.find(({ id }) => id === "runtime:board-water"),
		).toMatchObject({
			location: {
				generation: 0,
				phase: "outbound",
				scope: "delivery",
				target: {
					input: [
						{
							inputIndex: 0,
							quantity: 2,
						},
					],
				},
			},
			quantity: 2,
		});
		expect(result.staleRepeat).toEqual({
			acceptedQuantity: 0,
			status: "ignored",
		});
		expect(
			result.afterBoardContact.items
				.filter(({ location }) => location.scope === "input")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(4);
	});

	it("persists outbound motion facts and keeps the origin lease occupied", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const before = yield* readRuntimeFx();
				const state = yield* fromRuntimeFx({
					runtime: before,
				});
				const hydrated = yield* fromStateFx({
					state,
				});
				const conflictingSpawn = yield* Effect.result(
					spawnItemFx({
						id: "runtime:intruder",
						itemId: "water",
						location: sourceLocation(1),
						quantity: 1,
					}),
				);
				const intruder = yield* spawnItemFx({
					id: "runtime:mover",
					itemId: "water",
					location: sourceLocation(2),
					quantity: 1,
				});
				const conflictingMove = yield* Effect.result(
					moveItemFx({
						itemId: intruder.id,
						location: sourceLocation(1),
						revision: intruder.revision,
					}),
				);
				return {
					before,
					conflictingMove,
					conflictingSpawn,
					hydrated,
					state,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		const savedDelivery = result.state.items.find(({ id }) => id === "runtime:water");
		expect(savedDelivery?.location).toMatchObject({
			generation: 0,
			origin: sourceLocation(1),
			phase: "outbound",
			scope: "delivery",
		});
		expect(result.hydrated.items.find(({ id }) => id === "runtime:water")?.location).toEqual(
			savedDelivery?.location,
		);
		expect(Result.isFailure(result.conflictingSpawn)).toBe(true);
		if (Result.isFailure(result.conflictingSpawn)) {
			expect(result.conflictingSpawn.failure).toMatchObject({
				_tag: "LocationOccupiedError",
				itemId: "runtime:water",
				location: sourceLocation(1),
			});
		}
		expect(Result.isFailure(result.conflictingMove)).toBe(true);
		if (Result.isFailure(result.conflictingMove)) {
			expect(result.conflictingMove.failure).toMatchObject({
				_tag: "LocationOccupiedError",
				itemId: "runtime:water",
				location: sourceLocation(1),
			});
		}
	});

	it("leases and reclaims every authored Board footprint cell", () => {
		const leasedCell = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 1,
			},
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const conflictingSpawn = yield* Effect.result(
					spawnItemFx({
						id: "runtime:spawn-intruder",
						itemId: "stone",
						location: leasedCell,
						quantity: 1,
					}),
				);
				const mover = yield* spawnItemFx({
					id: "runtime:move-intruder",
					itemId: "stone",
					location: sourceLocation(4),
					quantity: 1,
				});
				const conflictingMove = yield* Effect.result(
					moveItemFx({
						itemId: mover.id,
						location: leasedCell,
						revision: mover.revision,
					}),
				);
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				const returned = yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 1,
				});
				return {
					conflictingMove,
					conflictingSpawn,
					returned,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: wideDeliveryConfig,
				}),
			),
		);

		expect(Result.isFailure(result.conflictingSpawn)).toBe(true);
		if (Result.isFailure(result.conflictingSpawn)) {
			expect(result.conflictingSpawn.failure).toMatchObject({
				_tag: "LocationOccupiedError",
				itemId: "runtime:water",
				location: leasedCell,
			});
		}
		expect(Result.isFailure(result.conflictingMove)).toBe(true);
		if (Result.isFailure(result.conflictingMove)) {
			expect(result.conflictingMove.failure).toMatchObject({
				_tag: "LocationOccupiedError",
				itemId: "runtime:water",
				location: leasedCell,
			});
		}
		expect(result.returned).toEqual({
			acceptedQuantity: 0,
			status: "returned",
		});
		expect(result.runtime.items.find(({ id }) => id === "runtime:water")).toMatchObject({
			location: sourceLocation(1),
		});
		const postReturnSpawn = Effect.runSync(
			spawnItemFx({
				id: "runtime:post-return-intruder",
				itemId: "stone",
				location: leasedCell,
				quantity: 1,
			}).pipe(
				Effect.result,
				useGameFx({
					config: wideDeliveryConfig,
					state: Effect.runSync(
						fromRuntimeFx({
							runtime: result.runtime,
						}),
					),
				}),
			),
		);
		expect(Result.isFailure(postReturnSpawn)).toBe(true);
		if (Result.isFailure(postReturnSpawn)) {
			expect(postReturnSpawn.failure).toMatchObject({
				_tag: "LocationOccupiedError",
				itemId: "runtime:water",
				location: leasedCell,
			});
		}
	});

	it("leases an Inventory source slot with the same canonical contract", () => {
		const inventoryOrigin = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: inventoryOrigin,
					quantity: 3,
				});
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const conflict = yield* Effect.result(
					spawnItemFx({
						id: "runtime:intruder",
						itemId: "water",
						location: inventoryOrigin,
						quantity: 1,
					}),
				);
				return {
					conflict,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(
			result.runtime.items.find(({ id }) => id === "runtime:water")?.location,
		).toMatchObject({
			origin: inventoryOrigin,
			scope: "delivery",
		});
		expect(Result.isFailure(result.conflict)).toBe(true);
	});

	it("redirects delivery home when its target owner is removed", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const owner = yield* getItemFx({
					itemId: ownerItemId,
				});
				yield* removeItemFx({
					itemId: owner.id,
					revision: owner.revision,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(runtime.items.find(({ id }) => id === "runtime:water")).toMatchObject({
			location: {
				generation: 1,
				phase: "returning",
				returnFrom: workshopLocation,
				scope: "delivery",
			},
		});
	});

	it("keeps one physical stack identity while allocating its contact across several slots", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const outbound = yield* readRuntimeFx();
				expect(
					outbound.items.find(({ id }) => id === "runtime:water")?.location,
				).toMatchObject({
					target: {
						input: [
							{
								inputIndex: 0,
								quantity: 3,
							},
							{
								inputIndex: 1,
								quantity: 2,
							},
						],
					},
				});
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: twoMaterialInputConfig,
				}),
			),
		);

		expect(
			runtime.items
				.filter(({ location }) => location.scope === "input")
				.map(({ location, quantity }) => ({
					inputIndex: location.scope === "input" ? location.inputIndex : -1,
					quantity,
				})),
		).toEqual([
			{
				inputIndex: 0,
				quantity: 3,
			},
			{
				inputIndex: 1,
				quantity: 2,
			},
		]);
		expect(runtime.items.find(({ id }) => id === "runtime:water")).toMatchObject({
			location: {
				phase: "returning",
				scope: "delivery",
			},
			quantity: 2,
		});
	});
});
