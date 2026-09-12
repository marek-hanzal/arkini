import { describe, expect, it } from "vitest";

import { readTileActorBadgeCountFn } from "~/tile-presentation/fn/readTileActorBadgeCountFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

const runtimeItem = (overrides: {
	readonly item: {
		readonly units?: {
			readonly amount: number;
		};
		readonly durationMs?: number;
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
	it("shows stack quantity only above one and projects units for finite items", () => {
		const single = runtimeItem({
			item: {},
		});
		const stack = runtimeItem({
			item: {},
			quantity: 120,
		});
		const freshProducer = runtimeItem({
			item: {
				units: {
					amount: 12,
				},
			},
		});
		const usedProducer = runtimeItem({
			item: {
				units: {
					amount: 12,
				},
			},
			remainingUnits: 4,
		});
		const freshFiniteItem = runtimeItem({
			item: {
				units: {
					amount: 8,
				},
			},
		});
		const usedFiniteItem = runtimeItem({
			item: {
				units: {
					amount: 8,
				},
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
