import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { planInputMaterialRunFx } from "~/v1/input/fx/run/planInputMaterialRunFx";
import type { InputMaterialResolutionSchema } from "~/v1/input/schema/resolution/InputMaterialResolutionSchema";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import { inputTestItems } from "~test/input/fx/support/inputTestItems";

const bufferedItem = ({ id, quantity }: { id: string; quantity: number }) => {
	return {
		id,
		item: inputTestItems.water,
		location: {
			scope: "input",
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
			inputIndex: 0,
			returnLocation: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
		},
		quantity,
		revision: `revision:${id}`,
	} satisfies InputRuntimeItemSchema.Type;
};

const resolution = ({ ready, runQuantity }: { ready: boolean; runQuantity: number }) => {
	return {
		type: "materials",
		mode: "consume",
		required: {
			min: 3,
			max: 3,
		},
		storedQuantity: ready ? 6 : 2,
		maxStoredQuantity: 8,
		runQuantity,
		missingQuantity: ready ? 0 : 1,
		availableCapacity: ready ? 2 : 6,
		ready,
	} satisfies InputMaterialResolutionSchema.Type;
};

describe("planInputMaterialRunFx", () => {
	it("allocates buffered items deterministically in runtime order", () => {
		const result = Effect.runSync(
			planInputMaterialRunFx({
				items: [
					bufferedItem({
						id: "runtime:water:a",
						quantity: 2,
					}),
					bufferedItem({
						id: "runtime:water:b",
						quantity: 4,
					}),
				],
				resolution: resolution({
					ready: true,
					runQuantity: 3,
				}),
			}),
		);

		expect(result).toEqual({
			type: "materials",
			mode: "consume",
			quantity: 3,
			item: [
				{
					itemId: "runtime:water:a",
					quantity: 2,
				},
				{
					itemId: "runtime:water:b",
					quantity: 1,
				},
			],
		});
	});

	it("returns undefined while the input is not ready", () => {
		const result = Effect.runSync(
			planInputMaterialRunFx({
				items: [
					bufferedItem({
						id: "runtime:water:a",
						quantity: 2,
					}),
				],
				resolution: resolution({
					ready: false,
					runQuantity: 0,
				}),
			}),
		);

		expect(result).toBeUndefined();
	});

	it("refuses an inconsistent ready resolution without enough concrete items", () => {
		const result = Effect.runSync(
			planInputMaterialRunFx({
				items: [
					bufferedItem({
						id: "runtime:water:a",
						quantity: 1,
					}),
				],
				resolution: resolution({
					ready: true,
					runQuantity: 3,
				}),
			}),
		);

		expect(result).toBeUndefined();
	});
});
