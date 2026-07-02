import { describe, expect, it } from "vitest";
import { createGameActionFromItemToBoardItemInteractionPlan } from "~/v0/play/interaction/createGameActionFromItemToBoardItemInteractionPlan";

const sourceRef = {
	kind: "board" as const,
	itemInstanceId: "source",
};

describe("createGameActionFromItemToBoardItemInteractionPlan", () => {
	it("maps executable item plans to engine actions", () => {
		expect(
			createGameActionFromItemToBoardItemInteractionPlan({
				plan: {
					type: "merge",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			sourceRef,
			targetItemInstanceId: "target",
			type: "item.merge",
		});

		expect(
			createGameActionFromItemToBoardItemInteractionPlan({
				plan: {
					feedbackVariant: "secondary",
					type: "craft-input",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			inputRef: sourceRef,
			targetItemInstanceId: "target",
			type: "craft.input.store",
		});

		expect(
			createGameActionFromItemToBoardItemInteractionPlan({
				plan: {
					feedbackVariant: "secondary",
					lineId: "line:test",
					type: "producer-input",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			inputRef: sourceRef,
			itemInstanceId: "target",
			lineId: "line:test",
			type: "producer.input.store",
		});

		expect(
			createGameActionFromItemToBoardItemInteractionPlan({
				plan: {
					feedbackVariant: "secondary",
					type: "stash-input",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			inputRefs: [
				sourceRef,
			],
			stashItemInstanceId: "target",
			type: "stash.open",
		});

		expect(
			createGameActionFromItemToBoardItemInteractionPlan({
				plan: {
					feedbackVariant: "primary",
					type: "tile-remove",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toEqual({
			targetItemInstanceId: "target",
			toolRef: sourceRef,
			type: "tile.remove",
		});
	});

	it("does not create engine actions for non-executable plans", () => {
		expect(
			createGameActionFromItemToBoardItemInteractionPlan({
				plan: {
					type: "swap",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toBeUndefined();

		expect(
			createGameActionFromItemToBoardItemInteractionPlan({
				plan: {
					type: "reject",
				},
				sourceRef,
				targetItemInstanceId: "target",
			}),
		).toBeUndefined();
	});
});
