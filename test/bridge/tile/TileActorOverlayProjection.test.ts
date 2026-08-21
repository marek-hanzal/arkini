import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readTileActorBadgeCountFx } from "~/bridge/tile/readTileActorBadgeCountFx";
import { readTileActorProgressRatioFx } from "~/bridge/tile/readTileActorProgressRatioFx";
import { readTileActorQueueBadgeCountFx } from "~/bridge/tile/readTileActorQueueBadgeCount";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { formatTileBadgeCount, formatTileBadgeLabel } from "~/ui/tile/formatTileBadgeCount";

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
		expect(
			formatTileBadgeLabel({
				count: 3,
				kind: "queue",
			}),
		).toBe("x3");
		expect(
			formatTileBadgeLabel({
				count: 1,
				kind: "queue",
			}),
		).toBe("x1");
		expect(
			formatTileBadgeLabel({
				count: 3,
			}),
		).toBe("3");
	});

	it("counts active and planned queue work for one exact owner", () => {
		const runtime = {
			jobs: [
				{
					ownerItemId: "runtime:owner",
				},
				{
					ownerItemId: "runtime:other",
				},
			],
			jobQueue: [
				{
					ownerItemId: "runtime:owner",
				},
				{
					ownerItemId: "runtime:owner",
				},
				{
					ownerItemId: "runtime:other",
				},
			],
		} as RuntimeSchema.Type;

		expect(
			Effect.runSync(
				readTileActorQueueBadgeCountFx({
					ownerItemId: "runtime:owner",
					runtime,
				}),
			),
		).toBe(3);
		expect(
			Effect.runSync(
				readTileActorQueueBadgeCountFx({
					ownerItemId: "runtime:other",
					runtime: {
						...runtime,
						jobs: [],
					},
				}),
			),
		).toBe(1);
		expect(
			Effect.runSync(
				readTileActorQueueBadgeCountFx({
					ownerItemId: "runtime:missing",
					runtime,
				}),
			),
		).toBeUndefined();
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
