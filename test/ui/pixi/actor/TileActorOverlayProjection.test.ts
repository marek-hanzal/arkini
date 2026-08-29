import { describe, expect, it } from "vitest";

import { readTileActorBadgeCountFn } from "~/ui/pixi/actor/fn/readTileActorBadgeCountFn";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { formatTileBadgeLabelFn } from "~/ui/tile/fn/formatTileBadgeLabelFn";

const runtimeItem = (overrides: {
	readonly item: {
		readonly charges?: {
			readonly amount: number;
		};
		readonly durationMs?: number;
		readonly type: RuntimeItemSchema.Type["item"]["type"];
	};
	readonly quantity?: number;
	readonly remainingCharges?: number;
	readonly remainingDurationMs?: number;
}) =>
	({
		quantity: 1,
		...overrides,
		item: overrides.item,
	}) as unknown as RuntimeItemSchema.Type;

describe("tile actor overlay projection", () => {
	it("uses one compact formatter for stack, queue, and capped badges", () => {
		expect(
			formatTileBadgeLabelFn({
				count: 1,
			}),
		).toBe("1");
		expect(
			formatTileBadgeLabelFn({
				count: 99,
			}),
		).toBe("99");
		expect(
			formatTileBadgeLabelFn({
				count: 100,
			}),
		).toBe("99+");
		expect(
			formatTileBadgeLabelFn({
				count: 450,
			}),
		).toBe("99+");
		expect(
			formatTileBadgeLabelFn({
				count: 3,
				kind: "queue",
			}),
		).toBe("x3");
		expect(
			formatTileBadgeLabelFn({
				count: 1,
				kind: "queue",
			}),
		).toBe("x1");
	});

	it("shows stack quantity only above one and always projects deposit charges", () => {
		const single = runtimeItem({
			item: {
				type: TypeSchema.enum.Simple,
			},
		});
		const stack = runtimeItem({
			item: {
				type: TypeSchema.enum.Simple,
			},
			quantity: 120,
		});
		const freshDeposit = runtimeItem({
			item: {
				charges: {
					amount: 12,
				},
				type: TypeSchema.enum.Deposit,
			},
		});
		const usedDeposit = runtimeItem({
			item: {
				charges: {
					amount: 12,
				},
				type: TypeSchema.enum.Deposit,
			},
			remainingCharges: 4,
		});

		expect(readTileActorBadgeCountFn(single)).toBeUndefined();
		expect(readTileActorBadgeCountFn(stack)).toBe(120);
		expect(readTileActorBadgeCountFn(freshDeposit)).toBe(12);
		expect(readTileActorBadgeCountFn(usedDeposit)).toBe(4);
	});
});
