import { describe, expect, it } from "vitest";

import { readTileActorBadgeCountFn } from "~/tile-presentation/fn/readTileActorBadgeCountFn";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

const runtimeItem = (overrides: {
	readonly item: {
		readonly units?: {
			readonly amount: number;
		};
		readonly durationMs?: number;
		readonly type: RuntimeItemSchema.Type["item"]["type"];
	};
	readonly quantity?: number;
	readonly remainingUnits?: number;
	readonly remainingDurationMs?: number;
}) =>
	({
		quantity: 1,
		...overrides,
		item: overrides.item,
	}) as unknown as RuntimeItemSchema.Type;

describe("tile actor overlay projection", () => {
	it("shows stack quantity only above one and projects units for every item type", () => {
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
				units: {
					amount: 12,
				},
				type: TypeSchema.enum.Producer,
			},
		});
		const usedProducer = runtimeItem({
			item: {
				units: {
					amount: 12,
				},
				type: TypeSchema.enum.Producer,
			},
			remainingUnits: 4,
		});
		const freshFiniteItem = runtimeItem({
			item: {
				units: {
					amount: 8,
				},
				type: TypeSchema.enum.Simple,
			},
		});
		const usedFiniteItem = runtimeItem({
			item: {
				units: {
					amount: 8,
				},
				type: TypeSchema.enum.Simple,
			},
			remainingUnits: 3,
		});

		expect(readTileActorBadgeCountFn(single)).toBeUndefined();
		expect(readTileActorBadgeCountFn(stack)).toBe(120);
		expect(readTileActorBadgeCountFn(freshProducer)).toBe(12);
		expect(readTileActorBadgeCountFn(usedProducer)).toBe(4);
		expect(readTileActorBadgeCountFn(freshFiniteItem)).toBe(8);
		expect(readTileActorBadgeCountFn(usedFiniteItem)).toBe(3);
	});
});
