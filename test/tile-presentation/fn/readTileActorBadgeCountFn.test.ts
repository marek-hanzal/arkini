import { describe, expect, it } from "vitest";

import { readTileActorBadgeCountFn } from "~/tile-presentation/fn/readTileActorBadgeCountFn";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

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
	it("shows stack quantity only above one and projects charges for every item type", () => {
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
		const freshProducer = runtimeItem({
			item: {
				charges: {
					amount: 12,
				},
				type: TypeSchema.enum.Producer,
			},
		});
		const usedProducer = runtimeItem({
			item: {
				charges: {
					amount: 12,
				},
				type: TypeSchema.enum.Producer,
			},
			remainingCharges: 4,
		});
		const freshChargedItem = runtimeItem({
			item: {
				charges: {
					amount: 8,
				},
				type: TypeSchema.enum.Simple,
			},
		});
		const usedChargedItem = runtimeItem({
			item: {
				charges: {
					amount: 8,
				},
				type: TypeSchema.enum.Simple,
			},
			remainingCharges: 3,
		});

		expect(readTileActorBadgeCountFn(single)).toBeUndefined();
		expect(readTileActorBadgeCountFn(stack)).toBe(120);
		expect(readTileActorBadgeCountFn(freshProducer)).toBe(12);
		expect(readTileActorBadgeCountFn(usedProducer)).toBe(4);
		expect(readTileActorBadgeCountFn(freshChargedItem)).toBe(8);
		expect(readTileActorBadgeCountFn(usedChargedItem)).toBe(3);
	});
});
