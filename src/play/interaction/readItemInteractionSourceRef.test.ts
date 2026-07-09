import { describe, expect, it } from "vitest";
import { readItemInteractionSourceRef } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";

describe("readItemInteractionSourceRef", () => {
	it("pins consumed source interactions to the planned consumed quantity", () => {
		expect(
			readItemInteractionSourceRef({
				plan: {
					consumedQuantity: 1,
					consumesSource: true,
					feedbackVariant: "secondary",
					type: "craft-input",
				},
				sourceRef: {
					kind: "board",
					itemInstanceId: "item-instance:source",
					quantity: 5,
				},
			}),
		).toEqual({
			kind: "board",
			itemInstanceId: "item-instance:source",
			quantity: 1,
		});
	});

	it("leaves non-consuming interactions unchanged", () => {
		const sourceRef = {
			kind: "board" as const,
			itemInstanceId: "item-instance:source",
		};

		expect(
			readItemInteractionSourceRef({
				plan: {
					consumedQuantity: 0,
					consumesSource: false,
					feedbackVariant: "primary",
					type: "tile-remove",
				},
				sourceRef,
			}),
		).toBe(sourceRef);
	});
});
