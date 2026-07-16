import { describe, expect, it } from "vitest";
import { readItemToBoardItemInteractionCommit } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";

const sourceRef = {
	kind: "board" as const,
	itemInstanceId: "source",
};

describe("readItemToBoardItemInteractionCommit", () => {
	it("pins consumed source interactions to the planned consumed quantity", () => {
		expect(
			readItemToBoardItemInteractionCommit({
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
				targetItemInstanceId: "target",
			}),
		).toEqual({
			action: {
				inputRef: {
					kind: "board",
					itemInstanceId: "item-instance:source",
					quantity: 1,
				},
				targetItemInstanceId: "target",
				type: "craft.input.store",
			},
			sourceRef: {
				kind: "board",
				itemInstanceId: "item-instance:source",
				quantity: 1,
			},
		});
	});

	it("maps executable item plans to engine actions", () => {
		expect(
			readItemToBoardItemInteractionCommit({
				plan: {
					type: "merge",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			action: {
				sourceRef,
				targetItemInstanceId: "target",
				type: "item.merge",
			},
			sourceRef,
		});

		expect(
			readItemToBoardItemInteractionCommit({
				plan: {
					consumedQuantity: 1,
					consumesSource: true,
					feedbackVariant: "secondary",
					lineId: "line:test",
					type: "producer-input",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			action: {
				inputRef: {
					...sourceRef,
					quantity: 1,
				},
				itemInstanceId: "target",
				lineId: "line:test",
				type: "producer.input.store",
			},
			sourceRef: {
				...sourceRef,
				quantity: 1,
			},
		});

		expect(
			readItemToBoardItemInteractionCommit({
				plan: {
					consumedQuantity: 1,
					consumesSource: true,
					feedbackVariant: "secondary",
					type: "stash-input",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			action: {
				inputRefs: [
					{
						...sourceRef,
						quantity: 1,
					},
				],
				stashItemInstanceId: "target",
				type: "stash.open",
			},
			sourceRef: {
				...sourceRef,
				quantity: 1,
			},
		});

		expect(
			readItemToBoardItemInteractionCommit({
				plan: {
					consumedQuantity: 1,
					consumesSource: true,
					feedbackVariant: "primary",
					type: "tile-remove",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			action: {
				targetItemInstanceId: "target",
				toolRef: {
					...sourceRef,
					quantity: 1,
				},
				type: "tile.remove",
			},
			sourceRef: {
				...sourceRef,
				quantity: 1,
			},
		});
	});

	it("does not create engine actions for non-executable plans", () => {
		expect(
			readItemToBoardItemInteractionCommit({
				plan: {
					type: "swap",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			action: undefined,
			sourceRef,
		});

		expect(
			readItemToBoardItemInteractionCommit({
				plan: {
					type: "reject",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			action: undefined,
			sourceRef,
		});
	});
});
