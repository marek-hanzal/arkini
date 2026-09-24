import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	inventoryTestConfigFn,
	inventoryStateFn,
	enterInventoryFx,
	removeInventoryItemFx,
} from "~test/space/support/inventoryTestConfig";
import { applyBoardTemplateFx } from "~/board-template/fx/applyBoardTemplateFx";

describe("Inventory lifecycle", () => {
	it("returns from a deleted viewed room to surviving history without reviving the deleted address", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const first = yield* enterInventoryFx("first");
				const second = yield* enterInventoryFx("second");
				const removed = yield* removeInventoryItemFx("second");
				const reused = yield* enterInventoryFx("first");
				return {
					first,
					second,
					removed,
					reused,
				};
			}).pipe(
				useGameFx({
					config: inventoryTestConfigFn(),
					state: inventoryStateFn(),
				}),
			),
		);
		expect(result.second.previousSpace).toBe(result.first.currentSpace);
		expect(result.removed.currentSpace).toBe(result.first.currentSpace);
		expect(result.removed.previousSpace).toBe(result.first.currentSpace);
		expect(result.removed.templateUidBySpace[result.second.currentSpace]).toBeUndefined();
		expect(
			result.removed.items.some(
				(item) =>
					item.location.scope === "board" &&
					item.location.space === result.second.currentSpace,
			),
		).toBe(false);
		expect(result.reused.currentSpace).toBe(result.first.currentSpace);
	});

	it("initializes self-referential templates lazily and recursively deletes nested rooms with start fallback", () => {
		const config = inventoryTestConfigFn();
		config.templates![0]!.board = [
			{
				itemUid: "warehouse",
				x: 0,
				y: 0,
			},
		];
		const result = Effect.runSync(
			Effect.gen(function* () {
				const outer = yield* enterInventoryFx("first");
				const child = outer.items.find(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === outer.currentSpace,
				)!;
				const inner = yield* enterInventoryFx(child.id);
				const removed = yield* removeInventoryItemFx("first");
				const reused = yield* enterInventoryFx("second");
				return {
					outer,
					child,
					inner,
					removed,
					reused,
				};
			}).pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
			),
		);
		expect(result.outer.items).toHaveLength(4);
		expect(result.child.inventories).toBeUndefined();
		expect(Object.keys(result.outer.templateUidBySpace)).toHaveLength(1);
		expect(result.inner.items).toHaveLength(5);
		expect(Object.keys(result.inner.templateUidBySpace)).toHaveLength(2);
		expect(result.inner.previousSpace).toBe(result.outer.currentSpace);
		expect(result.removed.currentSpace).toBe(0);
		expect(result.removed.previousSpace).toBeUndefined();
		expect(result.removed.templateUidBySpace).toEqual({});
		expect(result.removed.items.map((item) => item.id)).toEqual([
			"second",
			"cargo",
		]);
		expect(result.removed.jobs).toEqual([]);
		expect(result.removed.jobQueue).toEqual([]);
		expect(result.reused.currentSpace).toBe(result.outer.currentSpace);
		expect(result.reused.items.find((item) => item.id === "second")?.inventories?.room).toBe(
			result.outer.currentSpace,
		);
	});

	it("a template reset destroys nested owned rooms while preserving the surviving outer binding", () => {
		const config = inventoryTestConfigFn();
		config.templates![0]!.board = [
			{
				itemUid: "warehouse",
				x: 0,
				y: 0,
			},
		];
		const result = Effect.runSync(
			Effect.gen(function* () {
				const outer = yield* enterInventoryFx("first");
				const child = outer.items.find(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === outer.currentSpace,
				)!;
				const inner = yield* enterInventoryFx(child.id);
				yield* enterInventoryFx("first");
				const reset = yield* applyBoardTemplateFx({
					templateUid: "room",
				});
				return {
					outer,
					child,
					inner,
					reset,
				};
			}).pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
			),
		);
		expect(result.reset.currentSpace).toBe(result.outer.currentSpace);
		expect(result.reset.items.find((item) => item.id === "first")?.inventories?.room).toBe(
			result.outer.currentSpace,
		);
		expect(result.reset.items.some((item) => item.id === result.child.id)).toBe(false);
		expect(result.reset.templateUidBySpace[result.inner.currentSpace]).toBeUndefined();
		expect(result.reset.previousSpace).toBeUndefined();
		expect(
			result.reset.items.filter(
				(item) =>
					item.location.scope === "board" &&
					item.location.space === result.outer.currentSpace,
			),
		).toHaveLength(1);
	});
});
