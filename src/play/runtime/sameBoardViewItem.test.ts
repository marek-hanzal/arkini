import { describe, expect, it } from "vitest";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { sameBoardViewItem } from "~/play/runtime/sameBoardViewItem";

const createBoardViewItem = (overrides: Partial<BoardViewItem> = {}): BoardViewItem => ({
	id: "board:tree",
	itemId: "item:tree",
	state: {},
	x: 1,
	y: 2,
	...overrides,
});

describe("sameBoardViewItem", () => {
	it("treats quantity changes as board view changes", () => {
		expect(
			sameBoardViewItem(
				createBoardViewItem({
					quantity: 2,
				}),
				createBoardViewItem({
					quantity: 3,
				}),
			),
		).toBe(false);
	});
	it("treats capacity changes as board view changes", () => {
		expect(
			sameBoardViewItem(
				createBoardViewItem({
					capacity: {
						max: 18,
						remaining: 18,
					},
				}),
				createBoardViewItem({
					capacity: {
						max: 18,
						remaining: 17,
					},
				}),
			),
		).toBe(false);
	});

	it("treats matching capacity values as stable", () => {
		expect(
			sameBoardViewItem(
				createBoardViewItem({
					capacity: {
						max: 18,
						remaining: 17,
					},
				}),
				createBoardViewItem({
					capacity: {
						max: 18,
						remaining: 17,
					},
				}),
			),
		).toBe(true);
	});
});
