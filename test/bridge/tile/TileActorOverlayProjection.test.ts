import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readTileActorBadgeCountFx } from "~/bridge/tile/readTileActorBadgeCountFx";
import { readTileActorProgressRatioFx } from "~/bridge/tile/readTileActorProgressRatioFx";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { formatTileBadgeCount } from "~/ui/tile/formatTileBadgeCount";

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
	it("uses one compact formatter for stack and deposit badges", () => {
		expect(formatTileBadgeCount(1)).toBe("1");
		expect(formatTileBadgeCount(99)).toBe("99");
		expect(formatTileBadgeCount(100)).toBe("99+");
		expect(formatTileBadgeCount(450)).toBe("99+");
	});

	it("shows stack quantity only above one and always projects deposit charges", () => {
		const single = runtimeItem({
			item: {
				type: ItemEnumSchema.enum.Simple,
			},
		});
		const stack = runtimeItem({
			item: {
				type: ItemEnumSchema.enum.Simple,
			},
			quantity: 120,
		});
		const freshDeposit = runtimeItem({
			item: {
				charges: {
					amount: 12,
				},
				type: ItemEnumSchema.enum.Deposit,
			},
		});
		const usedDeposit = runtimeItem({
			item: {
				charges: {
					amount: 12,
				},
				type: ItemEnumSchema.enum.Deposit,
			},
			remainingCharges: 4,
		});

		expect(Effect.runSync(readTileActorBadgeCountFx(single))).toBeUndefined();
		expect(Effect.runSync(readTileActorBadgeCountFx(stack))).toBe(120);
		expect(Effect.runSync(readTileActorBadgeCountFx(freshDeposit))).toBe(12);
		expect(Effect.runSync(readTileActorBadgeCountFx(usedDeposit))).toBe(4);
	});

	it("fills job progress forward and temporary lifetime backward", () => {
		const owner = runtimeItem({
			item: {
				type: ItemEnumSchema.enum.Producer,
			},
		});
		const temporary = runtimeItem({
			item: {
				durationMs: 1_000,
				type: ItemEnumSchema.enum.Temporary,
			},
			remainingDurationMs: 600,
		});

		expect(
			Effect.runSync(
				readTileActorProgressRatioFx({
					activeJob: {
						durationMs: 1_000,
						id: "job:one",
						lineId: "line:one",
						ownerItemId: "runtime:owner",
						remainingMs: 600,
					},
					item: owner,
				}),
			),
		).toBeCloseTo(0.4);
		expect(
			Effect.runSync(
				readTileActorProgressRatioFx({
					item: temporary,
				}),
			),
		).toBeCloseTo(0.6);
		expect(
			Effect.runSync(
				readTileActorProgressRatioFx({
					item: owner,
				}),
			),
		).toBeUndefined();
	});
});
