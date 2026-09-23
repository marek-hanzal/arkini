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
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineUid = "line:workshop:build";
const spawnOwnerAndWaterFx = Effect.gen(function* () {
	yield* spawnItemFx({
		id: ownerItemId,
		itemUid: "workshop",
		location: workshopLocation,
	});
	yield* spawnItemFx({
		id: "runtime:water",
		itemUid: "water",
		location: sourceLocation(1),
	});
});

describe("settleItemDeliveryFx", () => {
	it("accelerates outbound and return travel without skipping contact or settling on toggle", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				yield* autofillLineInputsFx({
					ownerItemId,
					lineUid,
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
				const owner = yield* getItemFx({
					itemId: ownerItemId,
				});
				yield* removeRuntimeItemForTestFx({
					itemId: owner.id,
					revision: owner.revision,
				});
				const returning = yield* readRuntimeFx();
				for (let step = 0; step < 3; step++) {
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
			phase: "outbound",
			remainingDurationMs: 100,
		});
		expect(
			result.returning.items.find((item) => item.id === "runtime:water")?.location,
		).toMatchObject({
			scope: "delivery",
			phase: "returning",
			remainingDurationMs: 300,
		});
		expect(result.settled.items.find((item) => item.id === "runtime:water")).toMatchObject({
			location: sourceLocation(1),
		});
	});

	it("stores one identity only on contact and ignores stale settlement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				const admission = yield* autofillLineInputsFx({
					ownerItemId,
					lineUid,
				});
				const before = yield* readRuntimeFx();
				const settled = yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				const after = yield* readRuntimeFx();
				const hydrated = yield* fromStateFx({
					state: fromRuntimeFn({
						runtime: after,
					}),
				});
				const stale = yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				return {
					admission,
					before,
					settled,
					after,
					hydrated,
					stale,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);
		expect(result.admission.scheduledQuantity).toBe(1);
		expect(
			result.before.items.find((item) => item.id === "runtime:water")?.location.scope,
		).toBe("delivery");
		expect(result.settled).toMatchObject({
			status: "stored",
		});
		const item = result.after.items.find((item) => item.id === "runtime:water");
		expect(item?.location).toMatchObject({
			scope: "input",
			ownerItemId,
			lineUid,
			inputIndex: 0,
		});
		expect(result.hydrated.items.find((item) => item.id === "runtime:water")?.location).toEqual(
			item?.location,
		);
		expect(result.stale).toEqual({
			status: "ignored",
		});
	});

	it("persists outbound motion facts and keeps the origin lease occupied", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerAndWaterFx;
				yield* autofillLineInputsFx({
					ownerItemId,
					lineUid,
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
					itemUid: "stone",
					location: sourceLocation(2),
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
					lineUid,
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
});
