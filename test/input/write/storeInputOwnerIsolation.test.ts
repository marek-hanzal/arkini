import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { isItemPureFx } from "~/v1/item/fx/purity/isItemPureFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

const spawnOwnerFx = (quantity: number, scope: "board" | "inventory" = "board") => {
	return spawnItemFx({
		id: "runtime:workshop",
		itemId: "workshop",
		location:
			scope === "board"
				? {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					}
				: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
		quantity,
	});
};

const spawnSourceFx = (quantity: number) => {
	return spawnItemFx({
		id: "runtime:water",
		itemId: "water",
		location: sourceLocation(1),
		quantity,
	});
};

const storeFx = Effect.fn("storeOwnerIsolationMaterialFx")(function* (quantity: number) {
	const runtime = yield* readRuntimeFx();
	const source = runtime.items.find((item) => item.id === "runtime:water");
	if (source === undefined) throw new Error("Expected water source.");

	return yield* storeInputMaterialFx({
		ownerItemId: "runtime:workshop",
		lineId: "line:workshop:build",
		inputIndex: 0,
		sourceItemId: source.id,
		sourceItemRevision: source.revision,
		quantity,
	});
});

const fillRemainingCapacityFx = Effect.fn("fillRemainingInputIsolationCapacityFx")(function* () {
	for (const position of [
		{
			x: 2,
			y: 0,
		},
		{
			x: 3,
			y: 0,
		},
		{
			x: 4,
			y: 0,
		},
		{
			x: 0,
			y: 1,
		},
		{
			x: 1,
			y: 1,
		},
		{
			x: 2,
			y: 1,
		},
		{
			x: 3,
			y: 1,
		},
		{
			x: 4,
			y: 1,
		},
	]) {
		yield* spawnItemFx({
			id: `runtime:blocker:board:${position.x}:${position.y}`,
			itemId: "stone",
			location: {
				scope: "board",
				space: 0,
				position,
			},
			quantity: 1,
		});
	}

	for (let x = 0; x < 3; x += 1) {
		yield* spawnItemFx({
			id: `runtime:blocker:inventory:${x}`,
			itemId: "stone",
			location: {
				scope: "inventory",
				position: {
					x,
					y: 0,
				},
			},
			quantity: 1,
		});
	}
});

describe("input state owner isolation", () => {
	it("keeps the original owner identity stateful and reuses a fully consumed source cell", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx(2);
				yield* spawnSourceFx(1);
				yield* storeFx(1);
				const runtime = yield* readRuntimeFx();
				const owner = runtime.items.find((item) => item.id === "runtime:workshop");
				const remainder = runtime.items.find(
					(item) => item.item.id === "workshop" && item.id !== "runtime:workshop",
				);
				if (owner === undefined || remainder === undefined) {
					throw new Error("Expected isolated workshop owner and remainder.");
				}

				return {
					owner,
					ownerPure: yield* isItemPureFx({
						item: owner,
						runtime,
					}),
					remainder,
					remainderPure: yield* isItemPureFx({
						item: remainder,
						runtime,
					}),
					runtime,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.owner).toMatchObject({
			id: "runtime:workshop",
			location: workshopLocation,
			quantity: 1,
		});
		expect(result.ownerPure).toBe(false);
		expect(result.remainder).toMatchObject({
			location: sourceLocation(1),
			quantity: 1,
		});
		expect(result.remainderPure).toBe(true);
		expect(
			result.runtime.items.find((item) => item.id === "runtime:water")?.location,
		).toMatchObject({
			scope: "input",
			ownerItemId: "runtime:workshop",
		});
	});

	it("rolls back partial source storage when the remainder has no board or inventory capacity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx(2);
				yield* spawnSourceFx(2);
				yield* fillRemainingCapacityFx();
				const before = yield* readRuntimeFx();
				const stored = yield* Effect.either(storeFx(1));

				return {
					after: yield* readRuntimeFx(),
					before,
					stored,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result.stored)).toBe(true);
		if (Either.isLeft(result.stored)) {
			expect(result.stored.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "workshop",
				reason: "inventory:full",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rejects state attachment while the owner is stored in inventory", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx(1, "inventory");
				yield* spawnSourceFx(1);
				const before = yield* readRuntimeFx();
				const stored = yield* Effect.either(storeFx(1));

				return {
					after: yield* readRuntimeFx(),
					before,
					stored,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(Either.isLeft(result.stored)).toBe(true);
		if (Either.isLeft(result.stored)) {
			expect(result.stored.left).toMatchObject({
				_tag: "ItemNotOnBoardError",
				itemId: "runtime:workshop",
				location: {
					scope: "inventory",
				},
			});
		}
		expect(result.after).toEqual(result.before);
	});
});
