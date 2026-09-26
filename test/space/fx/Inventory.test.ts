import { LineSchema } from "~/production-line/schema/LineSchema";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	inventoryTestConfigFn,
	inventoryStateFn,
	enterInventoryFx,
	removeInventoryItemFx,
} from "~test/space/support/inventoryTestConfig";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const applyInventoryOutcomeFx = (config: GameConfigSchema.Type) =>
	modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const outcome = yield* resolveOutcomeTableFx({
				ownerItemId: "first",
				origin: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
				outcome: config.items.warehouse!.lines[0]!.outcome!,
			});
			const [, next] = yield* applyOutcomeTableFx({
				outcome,
				runtime,
			});
			return [
				undefined,
				next,
			] as const;
		}),
	);

describe("Inventory", () => {
	it("keeps two equally weighted template Inventories separate and destroys both with their owner", () => {
		const secondTemplateUid = "toString";
		const config = inventoryTestConfigFn();
		config.templates!.push({
			...structuredClone(config.templates![0]!),
			uid: secondTemplateUid,
		});
		const firstSet = structuredClone(config.items.warehouse!.lines[0]!.outcome!.set[0]!);
		const secondSet = structuredClone(firstSet);
		firstSet.weight = 1;
		secondSet.weight = 1;
		const secondDestination = secondSet.roll[0]!.outcome[0]!;
		if (secondDestination.type !== "space" || typeof secondDestination.space !== "object")
			throw new Error("Expected an Inventory outcome");
		secondDestination.space.templateUid = secondTemplateUid;
		config.items.warehouse!.lines[0]!.outcome = {
			set: [
				firstSet,
				secondSet,
			],
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* applyInventoryOutcomeFx(config);
				const first = yield* readRuntimeFx();
				yield* applyInventoryOutcomeFx(config);
				const second = yield* readRuntimeFx();
				const removed = yield* removeInventoryItemFx("first");
				return {
					first,
					second,
					removed,
				};
			}).pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.1,
						0.9,
					]),
				),
			),
		);
		const firstSpace = result.first.currentSpace;
		const secondSpace = result.second.currentSpace;
		expect(secondSpace).not.toBe(firstSpace);
		const bindings = Object.fromEntries([
			[
				"room",
				firstSpace,
			],
			[
				secondTemplateUid,
				secondSpace,
			],
		]);
		expect(result.second.items.find((item) => item.id === "first")?.inventories).toEqual(
			bindings,
		);
		const saved = StateSchema.parse(
			fromRuntimeFn({
				runtime: result.second,
			}),
		);
		expect(saved.items.find((item) => item.id === "first")?.inventories).toEqual(bindings);
		expect(result.second.templateUidBySpace).toEqual({
			[firstSpace]: "room",
			[secondSpace]: secondTemplateUid,
		});
		expect(
			result.second.items.filter(
				(item) =>
					item.location.scope === "board" &&
					(item.location.space === firstSpace || item.location.space === secondSpace),
			),
		).toHaveLength(2);
		expect(result.removed.currentSpace).toBe(0);
		expect(result.removed.templateUidBySpace).toEqual({});
		expect(
			result.removed.items.some(
				(item) =>
					item.location.scope === "board" &&
					(item.location.space === firstSpace || item.location.space === secondSpace),
			),
		).toBe(false);
	});

	it("reuses one Space when weighted outcomes select the same template", () => {
		const config = inventoryTestConfigFn();
		const line = config.items.warehouse!.lines[0]!;
		line.outcome!.set.push(structuredClone(line.outcome!.set[0]!));
		line.outcome!.set[0]!.weight = 1;
		line.outcome!.set[1]!.weight = 1;
		expect(ItemSchema.safeParse(config.items.warehouse).success).toBe(true);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* applyInventoryOutcomeFx(config);
				const first = yield* readRuntimeFx();
				yield* applyInventoryOutcomeFx(config);
				const second = yield* readRuntimeFx();
				return {
					first,
					second,
				};
			}).pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.1,
						0.9,
					]),
				),
			),
		);
		expect(result.second.currentSpace).toBe(result.first.currentSpace);
		expect(result.second.items.find((item) => item.id === "first")?.inventories).toEqual({
			room: result.first.currentSpace,
		});
		expect(result.second.templateUidBySpace).toEqual({
			[result.first.currentSpace]: "room",
		});
	});

	it("rejects a template UID that cannot survive JSON record parsing", () => {
		const config = inventoryTestConfigFn();
		const destination = config.items.warehouse!.lines[0]!.outcome!.set[0]!.roll[0]!.outcome[0]!;
		if (destination.type !== "space" || typeof destination.space !== "object")
			throw new Error("Expected Inventory outcome");
		destination.space.templateUid = "__proto__";
		expect(ItemSchema.safeParse(config.items.warehouse).success).toBe(false);
	});

	it("binds separate rooms to identical owners and reuses edited contents across visits and save/load", () => {
		const config = inventoryTestConfigFn();
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const first = yield* enterInventoryFx("first");
				const originalToken = first.items.find(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === first.currentSpace,
				)!;
				yield* removeInventoryItemFx(originalToken.id);
				const repeated = yield* enterInventoryFx("first");
				const second = yield* enterInventoryFx("second");
				return {
					before,
					first,
					originalToken,
					repeated,
					second,
				};
			}).pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
			),
		);
		expect(result.before.items.every((item) => item.inventories === undefined)).toBe(true);
		expect(result.before.templateUidBySpace).toEqual({});
		expect(result.first.currentSpace).not.toBe(0);
		expect(result.first.items.find((item) => item.id === "first")?.inventories?.room).toBe(
			result.first.currentSpace,
		);
		expect(result.repeated.currentSpace).toBe(result.first.currentSpace);
		expect(result.repeated.items.some((item) => item.id === result.originalToken.id)).toBe(
			false,
		);
		expect(
			result.repeated.items.filter(
				(item) =>
					item.location.scope === "board" &&
					item.location.space === result.first.currentSpace,
			),
		).toEqual([]);
		expect(result.second.currentSpace).not.toBe(result.first.currentSpace);
		expect(
			readBoardSizeFn({
				config,
				runtime: result.second,
				space: result.second.currentSpace,
			}),
		).toEqual({
			width: 2,
			height: 1,
		});
		const secondToken = result.second.items.find(
			(item) =>
				item.location.scope === "board" &&
				item.location.space === result.second.currentSpace,
		)!;
		expect(secondToken.id).not.toBe(result.originalToken.id);
		const state = StateSchema.parse(
			JSON.parse(
				JSON.stringify(
					fromRuntimeFn({
						runtime: result.second,
					}),
				),
			),
		);
		const loaded = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const after = yield* enterInventoryFx("second");
				return {
					before,
					after,
				};
			}).pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);
		expect(
			loaded.before.items.map((item) => [
				item.id,
				item.inventories,
			]),
		).toEqual(
			result.second.items.map((item) => [
				item.id,
				item.inventories,
			]),
		);
		expect(loaded.after.currentSpace).toBe(result.second.currentSpace);
		expect(loaded.after.items.map((item) => item.id)).toEqual(
			result.second.items.map((item) => item.id),
		);
	});

	it("reserves empty authored destinations before allocating an Inventory Space address", () => {
		const config = inventoryTestConfigFn();
		config.items.token!.merge = [
			{
				action: "space",
				space: 1,
				effect: "keep",
			},
		];
		config.items.upgrade!.lines = [
			LineSchema.parse({
				...config.items.warehouse!.lines[0]!,
				uid: "fixed",
				title: "Fixed",
				description: "Fixed",
				runtimeMs: 0,
				input: [],
				rules: [],
				outcome: {
					set: [
						{
							rules: [],
							roll: [
								{
									type: "guaranteed",
									outcome: [
										{
											type: "space",
											space: 2,
											rules: [],
										},
										{
											type: "template",
											templateUid: "room",
											space: 3,
											rules: [],
										},
									],
								},
							],
						},
					],
				},
			}),
		];
		const runtime = Effect.runSync(
			enterInventoryFx("first").pipe(
				useGameFx({
					config,
					state: inventoryStateFn(),
				}),
			),
		);
		expect([
			0,
			1,
			2,
			3,
		]).not.toContain(runtime.currentSpace);
		expect(runtime.items.find((item) => item.id === "first")?.inventories?.room).toBe(
			runtime.currentSpace,
		);
	});
});
