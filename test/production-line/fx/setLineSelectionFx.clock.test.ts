import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { readEffectiveLineFn } from "~/production-line/fn/readEffectiveLineFn";
import { setLineSelectionFx } from "~/production-line/fx/setLineSelectionFx";
import { lineRunTestConfig } from "~test/production-line/support/lineRunTestRuntime";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";

const workshop = lineRunTestConfig.items.workshop;
const config = GameConfigSchema.parse({
	...lineRunTestConfig,
	items: {
		...lineRunTestConfig.items,
		workshop: {
			...workshop,
			clock: {
				intervalMs: 300,
				durationMs: 1_000,
			},
			lines: [
				{
					...workshop.lines[0],
					id: "manual",
					default: true,
					clock: false,
				},
				{
					...workshop.lines[0],
					id: "pulse",
					default: false,
					clock: true,
				},
			],
		},
	},
});
const spawnOwnerFx = spawnItemFx({
	id: "owner",
	itemId: "workshop",
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	quantity: 1,
});

describe("independent Clock line selection", () => {
	it("persists a cleared clock role without changing the default, phase, or lifetime", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnOwnerFx;
				const before = yield* readRuntimeFx();
				const authored = {
					default: readEffectiveLineFn({
						ownerItemId: owner.id,
						ownerItem: owner.item,
						runtime: before,
						selection: "default",
					})?.id,
					clock: readEffectiveLineFn({
						ownerItemId: owner.id,
						ownerItem: owner.item,
						runtime: before,
						selection: "clock",
					})?.id,
				};
				yield* setLineSelectionFx({
					ownerItemId: owner.id,
					selection: "clock",
					lineId: "manual",
				});
				const selected = yield* readRuntimeFx();
				yield* setLineSelectionFx({
					ownerItemId: owner.id,
					selection: "default",
					lineId: "pulse",
				});
				yield* setLineSelectionFx({
					ownerItemId: owner.id,
					selection: "clock",
					lineId: null,
				});
				const cleared = yield* readRuntimeFx();
				const restored = yield* fromStateFx({
					state: fromRuntimeFn({
						runtime: cleared,
					}),
				});
				const clock = readEffectiveLineFn({
					ownerItemId: owner.id,
					ownerItem: owner.item,
					runtime: restored,
					selection: "clock",
				});
				return {
					authored,
					before,
					selected,
					cleared,
					restored,
					clock,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.authored).toEqual({
			default: "manual",
			clock: "pulse",
		});
		expect(result.selected.items[0].schedule).toEqual({
			...result.before.items[0].schedule,
			lineId: "manual",
		});
		expect(result.selected.defaultLineByOwnerItemId).toEqual({});
		expect(result.cleared.defaultLineByOwnerItemId).toEqual({
			owner: "pulse",
		});
		expect(result.restored.items[0].schedule).toEqual({
			...result.before.items[0].schedule,
			lineId: null,
		});
		expect(result.clock).toBeUndefined();
	});

	it("rejects a foreign selected line atomically", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx;
				const before = yield* readRuntimeFx();
				const rejected = yield* setLineSelectionFx({
					ownerItemId: "owner",
					selection: "clock",
					lineId: "foreign",
				}).pipe(Effect.result);
				return {
					before,
					after: yield* readRuntimeFx(),
					rejected,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.rejected).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "LineNotFoundError",
				}),
			),
		);
		expect(result.after).toEqual(result.before);
	});
});
