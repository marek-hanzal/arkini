// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it } from "vitest";

import {
	commands,
	input,
	projection,
	renderLines,
	selectAllLines,
} from "../support/ItemLinesTabFixture";

describe("ItemLinesTab command boundary", () => {
	it.each([
		"default",
		"clock",
	] as const)(
		"wires the %s role to its exact owner, line, and clearing command",
		async (selection) => {
			const line = {
				...projection.line[0],
				clock: {
					selected: false,
					canChange: true,
				},
			};
			const { rerender } = await renderLines({
				...projection,
				line: [
					line,
				],
			});
			const selector =
				selection === "default"
					? '[data-ui="TileLineSetDefaultButton"]'
					: '[data-ui="TileLineSetClockButton"]';
			await act(async () => document.querySelector<HTMLButtonElement>(selector)?.click());
			expect(commands.select).toHaveBeenCalledWith({
				selection,
				ownerItemId: projection.itemId,
				lineId: line.lineId,
			});

			await rerender({
				...projection,
				line: [
					{
						...line,
						isDefault: selection === "default",
						clock: {
							selected: selection === "clock",
							canChange: true,
						},
					},
				],
			});
			await act(async () => document.querySelector<HTMLButtonElement>(selector)?.click());
			expect(commands.select).toHaveBeenCalledWith({
				selection,
				ownerItemId: projection.itemId,
				lineId: null,
			});
		},
	);

	it("wires enqueue to the exact owner and line", async () => {
		await renderLines(projection);
		const enqueue = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineEnqueueButton"]',
		);

		await act(async () => enqueue?.click());
		expect(commands.enqueue).toHaveBeenCalledWith({
			ownerItemId: projection.itemId,
			lineId: projection.line[0]?.lineId,
		});
	});

	it("wires whole-line withdrawal to the exact owner and line", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					actions: {
						...projection.line[0].actions,
						canWithdraw: true,
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
		const withdraw = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineWithdrawButton"]',
		);

		await act(async () => withdraw?.click());
		expect(commands.withdraw).toHaveBeenCalledWith({
			lineId: projection.line[0]?.lineId,
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
						canChangeDefault: false,
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
