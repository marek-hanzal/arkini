import { describe, expect, it } from "vitest";
import type { TileEngine } from "~/tile-engine/TileEngine.types";
import { sameTileEngineSlot } from "~/tile-engine/sameTileEngineSlot";

const createSlot = (
	overrides: Partial<
		TileEngine.Slot<{
			value: string;
		}>
	> = {},
) =>
	({
		id: "slot-1",
		dropId: "drop-1",
		data: {
			value: "a",
		},
		...overrides,
	}) satisfies TileEngine.Slot<{
		value: string;
	}>;

describe("sameTileEngineSlot", () => {
	it("treats equal render keys as equivalent even when data objects are recreated", () => {
		expect(
			sameTileEngineSlot(
				createSlot({
					renderKey: "same",
				}),
				createSlot({
					renderKey: "same",
				}),
			),
		).toBe(true);
	});

	it("falls back to data identity when render keys are not provided", () => {
		const data = {
			value: "a",
		};

		expect(
			sameTileEngineSlot(
				createSlot({
					data,
				}),
				createSlot({
					data,
				}),
			),
		).toBe(true);
		expect(sameTileEngineSlot(createSlot(), createSlot())).toBe(false);
	});

	it("keeps drop identity and disabled changes observable", () => {
		expect(
			sameTileEngineSlot(
				createSlot({
					renderKey: "same",
				}),
				createSlot({
					dropId: "drop-2",
					renderKey: "same",
				}),
			),
		).toBe(false);
		expect(
			sameTileEngineSlot(
				createSlot({
					renderKey: "same",
				}),
				createSlot({
					disabled: true,
					renderKey: "same",
				}),
			),
		).toBe(false);
	});
});
