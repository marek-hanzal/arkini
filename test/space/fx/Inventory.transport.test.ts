import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	inventoryTestConfigFn,
	inventoryStateFn,
	enterInventoryFx,
	mergeInventoryItemsFx,
} from "~test/space/support/inventoryTestConfig";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";

describe("Inventory transport", () => {
	it("sends merged items into a room that an outcome created first", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const entered = yield* enterInventoryFx("first");
				yield* mergeInventoryItemsFx("cargo", "first");
				return {
					entered,
					transported: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: inventoryTestConfigFn(),
					state: inventoryStateFn(),
				}),
			),
		);
		const room = result.entered.currentSpace;
		expect(result.transported.items.find((item) => item.id === "first")?.inventories).toEqual({
			room,
		});
		expect(
			result.transported.items.find((item) => item.id === "cargo")?.location,
		).toMatchObject({
			scope: "board",
			space: room,
		});
		expect(result.transported.templateUidBySpace).toEqual({
			[room]: "room",
		});
	});

	it("keeps transport separate when the merge references another template", () => {
		const config = inventoryTestConfigFn();
		config.templates!.push({
			...structuredClone(config.templates![0]!),
			uid: "hidden-room",
		});
		const merge = config.items.warehouse!.merge![0]!;
		if (merge.action !== "space") throw new Error("Expected an Inventory merge");
		const destination = merge.space;
		if (typeof destination !== "object" || destination.type !== "inventory")
			throw new Error("Expected an Inventory merge destination");
		destination.templateUid = "hidden-room";
		const result = Effect.runSync(
			Effect.gen(function* () {
				const entered = yield* enterInventoryFx("first");
				yield* mergeInventoryItemsFx("cargo", "first");
				return {
					entered,
					transported: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
			),
		);
		const visibleRoom = result.entered.currentSpace;
		const hiddenRoom = result.transported.items.find((item) => item.id === "first")
			?.inventories?.["hidden-room"];
		expect(hiddenRoom).toBeDefined();
		expect(hiddenRoom).not.toBe(visibleRoom);
		expect(
			result.transported.items.find((item) => item.id === "cargo")?.location,
		).toMatchObject({
			scope: "board",
			space: hiddenRoom,
		});
		expect(result.transported.currentSpace).toBe(visibleRoom);
		expect(result.transported.templateUidBySpace).toEqual({
			[visibleRoom]: "room",
			[hiddenRoom!]: "hidden-room",
		});
	});

	it("drops near the occupied center of a new template room and shares it with subsequent navigation", () => {
		const config = inventoryTestConfigFn();
		config.templates![0]!.width = 5;
		config.templates![0]!.height = 3;
		config.templates![0]!.board[0]!.x = 2;
		config.templates![0]!.board[0]!.y = 1;
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* mergeInventoryItemsFx("cargo", "first");
				const transported = yield* readRuntimeFx();
				const entered = yield* enterInventoryFx("first");
				return {
					transported,
					entered,
				};
			}).pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
			),
		);
		const room = result.transported.items.find((item) => item.id === "first")!.inventories
			?.room;
		expect(room).toBeDefined();
		expect(result.transported.currentSpace).toBe(0);
		expect(result.transported.previousSpace).toBeUndefined();
		expect(result.transported.items.find((item) => item.id === "cargo")?.location).toEqual({
			scope: "board",
			space: room,
			position: {
				x: 2,
				y: 0,
			},
		});
		expect(result.entered.currentSpace).toBe(room);
		expect(result.entered.items.map((item) => item.id)).toEqual(
			result.transported.items.map((item) => item.id),
		);
	});

	it("rolls back room creation, owner binding and transport when the initialized template is full", () => {
		const config = inventoryTestConfigFn();
		config.templates![0]!.width = 1;
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* (yield* CommittedTransitionsFx).read;
				const attempt = yield* mergeInventoryItemsFx("cargo", "first").pipe(Effect.result);
				return {
					before,
					attempt,
					after: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
			),
		);
		expect(Result.isFailure(result.attempt)).toBe(true);
		expect(result.after).toBe(result.before);
		expect(result.after.runtime.templateUidBySpace).toEqual({});
		expect(
			result.after.runtime.items.find((item) => item.id === "first")?.inventories,
		).toBeUndefined();
	});

	it("preserves the room and contents when a replacement retains the owner identity", () => {
		const state = inventoryStateFn([
			{
				id: "first",
				itemUid: "warehouse",
				x: 0,
			},
			{
				id: "upgrade",
				itemUid: "upgrade",
				x: 1,
			},
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* enterInventoryFx("first");
				yield* mergeInventoryItemsFx("upgrade", "first");
				return {
					before,
					after: yield* enterInventoryFx("first"),
				};
			}).pipe(
				useGameFx({
					config: inventoryTestConfigFn(),
					state,
				}),
			),
		);
		expect(result.after.items.find((item) => item.id === "first")?.inventories?.room).toBe(
			result.before.currentSpace,
		);
		expect(result.after.currentSpace).toBe(result.before.currentSpace);
		expect(
			result.after.items
				.filter(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === result.before.currentSpace,
				)
				.map((item) => item.id),
		).toEqual(
			result.before.items
				.filter(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === result.before.currentSpace,
				)
				.map((item) => item.id),
		);
	});
});
