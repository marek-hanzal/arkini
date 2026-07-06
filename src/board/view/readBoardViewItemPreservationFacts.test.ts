import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { readBoardViewItemPreservationFacts } from "~/board/view/readBoardViewItemPreservationFacts";

const boardItem = (overrides: Partial<BoardViewItem> = {}): BoardViewItem => ({
	id: "item-instance:target",
	itemId: "item:target",
	state: {},
	x: 0,
	y: 0,
	...overrides,
});

const producerActivation = (
	overrides: Partial<NonNullable<BoardViewItem["activation"]>> = {},
): NonNullable<BoardViewItem["activation"]> => ({
	inputs: [],
	kind: "producer",
	trigger: "click",
	...overrides,
});

type BoardViewLine = NonNullable<NonNullable<BoardViewItem["activation"]>["lines"]>[number];

const productLine = (overrides: Partial<BoardViewLine> = {}): BoardViewLine => ({
	blocked: false,
	durationMs: 100,
	inProgress: false,
	inputItemIds: [],
	inputs: [],
	inputsAvailable: true,
	inputsReady: true,
	isDefault: false,
	jobs: 0,
	kind: "product",
	lineId: "line:test",
	name: "Test",
	queueFull: false,
	queueMax: 1,
	queueUsed: 0,
	...overrides,
});

describe("readBoardViewItemPreservationFacts", () => {
	it("treats selected producer line as control state, not runtime state", () => {
		expect(
			readBoardViewItemPreservationFacts(
				boardItem({
					activation: producerActivation({
						lines: [
							productLine({
								isDefault: true,
							}),
						],
					}),
				}),
			),
		).toEqual({
			hasControlState: true,
			hasRuntimeState: false,
			requiresInstancePreservation: true,
		});
	});

	it("treats stored activation input as runtime state", () => {
		expect(
			readBoardViewItemPreservationFacts(
				boardItem({
					activation: producerActivation({
						lines: [
							productLine({
								inputs: [
									{
										capacity: 2,
										consume: true,
										itemId: "item:input",
										quantity: 1,
										stored: 1,
									},
								],
							}),
						],
					}),
				}),
			),
		).toEqual({
			hasControlState: false,
			hasRuntimeState: true,
			requiresInstancePreservation: true,
		});
	});
});
