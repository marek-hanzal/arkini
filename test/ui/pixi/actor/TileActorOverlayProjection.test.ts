import { describe, expect, it } from "vitest";

import { readTileActorBadgeCountFn } from "~/ui/pixi/actor/fn/readTileActorBadgeCountFn";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

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
