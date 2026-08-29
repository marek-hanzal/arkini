// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it } from "vitest";

import {
	commands,
	input,
	projection,
	renderLines,
	selectAllLines,
} from "./ItemLinesTab.commands.test/fixture";

describe("ItemLinesTab command boundary", () => {
	it("wires save-backed default set and unset to the exact owner and line", async () => {
		const { rerender } = await renderLines(projection);
		const defaultButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineSetDefaultButton"]',
		);
		await act(async () => defaultButton?.click());
		expect(commands.setDefault).toHaveBeenCalledWith({
			ownerItemId: projection.itemId,
			lineId: projection.line[0]?.lineId,
		});

		await rerender({
			...projection,
			line: [
				{
					...projection.line[0],
					isDefault: true,
				},
			],
		});
		const unsetButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineSetDefaultButton"]',
		);
		await act(async () => unsetButton?.click());
		expect(commands.unsetDefault).toHaveBeenCalledWith({
			ownerItemId: projection.itemId,
		});
	});

	it("keeps exact buffered-input withdrawal available after a line becomes unavailable", async () => {
		const { container } = await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					actions: {
						canWithdraw: true,
						enqueue: {
							enabled: false,
						},
					},
					availability: {
						kind: "unavailable",
						reason: {
							itemId: "tree",
							itemTitle: "Tree",
							kind: "direct-output-capacity",
							liveQuantity: 1,
							maxCount: 1,
							message: "Tree limit reached.",
							messageAfterTitle: "limit reached.",
							reservedQuantity: 0,
						},
					},
					input: [
						{
							...input,
							canWithdraw: true,
							missingQuantity: 0,
							storedQuantity: 1,
						},
					],
				},
			],
		});
		await selectAllLines(container);
		const withdraw = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputWithdrawButton"]',
		);

		expect(withdraw?.disabled).toBe(false);
		await act(async () => withdraw?.click());
		expect(commands.withdraw).toHaveBeenCalledWith({
			inputIndex: 0,
			lineId: projection.line[0]?.lineId,
			ownerItemId: projection.itemId,
		});
	});
});
