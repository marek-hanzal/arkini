import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { setSpeedUpGameplayFx } from "~/game-cheat/fx/setSpeedUpGameplayFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { settleItemDeliveryFx } from "~test/support/settleItemDeliveryFx";
import { useGameFx } from "~test/support/useGameFx";
import { autofillLineInputsFx } from "~test/support/autofillLineInputsFx";
import { getItemFx } from "~test/support/getItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { DropItemRejectedReason, DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";
const workshop = inputRuntimeTestConfig.items.workshop;
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
						query: {
							distance: "far" as const,
							selector: {
								type: "item",
								itemId: "water",
							},
						},
						quantity: {
							min: 2,
							max: 2,
						},
					},
					...line.input.slice(1),
				],
			})),
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
	it("accelerates outbound and return travel without skipping contact or settling on toggle", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const before = yield* readRuntimeFx();
				yield* setCheatEnabledFx({
					enabled: true,
				});
				yield* setSpeedUpGameplayFx({
					enabled: true,
				});
				const enabled = yield* readRuntimeFx();
				for (let step = 0; step < 2; step++) {
					yield* runTickRuntimeByFx({
						elapsedMs: 50,
					});
				}
				const outbound = yield* readRuntimeFx();
				for (let step = 0; step < 2; step++) {
					yield* runTickRuntimeByFx({
						elapsedMs: 50,
					});
				}
				const returning = yield* readRuntimeFx();
				for (let step = 0; step < 2; step++) {
					yield* runTickRuntimeByFx({
						elapsedMs: 50,
					});
				}
				return {
					before,
					enabled,
					outbound,
					returning,
					settled: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
					speedUpMultiplier: 2,
				}),
			),
		);
		expect(result.enabled.items).toBe(result.before.items);
		expect(
			result.outbound.items.find((item) => item.id === "runtime:water")?.location,
		).toMatchObject({
			scope: "delivery",
			remainingDurationMs: 100,
		});
		expect(
			result.returning.items.find((item) => item.id === "runtime:water")?.location,
		).toMatchObject({
			scope: "delivery",
			remainingDurationMs: 200,
		});
		expect(result.settled.items.find((item) => item.id === "runtime:water")).toMatchObject({
			quantity: 4,
			location: sourceLocation(1),
		});
	});

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
				const returningState = fromRuntimeFn({
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

	it("persists outbound motion facts and keeps the origin lease occupied", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				const before = yield* readRuntimeFx();
				const state = fromRuntimeFn({
					runtime: before,
				});
				const hydrated = yield* fromStateFx({
					state,
				});
				const intruder = yield* spawnItemFx({
					id: "runtime:mover",
					itemId: "stone",
					location: sourceLocation(2),
					quantity: 1,
				});
				const conflictingMove = yield* dropItemFx({
					sourceItemId: intruder.id,
					sourceLocation: intruder.location,
					sourceRevision: intruder.revision,
					target: {
						kind: "slot",
						location: sourceLocation(1),
						occupant: null,
					},
				});
				return {
					before,
					conflictingMove,
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
		expect(result.conflictingMove).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.Occupied,
			itemId: "runtime:mover",
		});
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
				yield* removeRuntimeItemForTestFx({
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
