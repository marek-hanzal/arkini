// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { act } from "react";

import {
	__fixture_commands as commands,
	input,
	projection,
	renderLines,
	selectAvailabilityFilter,
} from "./ItemLinesTab.test/fixture";

describe("ItemLinesTab / withdrawal limits and rules", () => {
	it("withdraws the complete exact material input from its local row action", async () => {
		const filledProjection = {
			...projection,
			line: [
				{
					...projection.line[0],
					actions: {
						enqueue: {
							enabled: true,
						},
						canWithdraw: true,
					},
					input: [
						{
							...input,
							availableCapacity: 0,
							missingQuantity: 0,
							storedQuantity: 5,
							canWithdraw: true,
						},
					],
				},
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { rerender } = await renderLines(filledProjection);
		const inputWithdraw = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputWithdrawButton"]',
		);
		const lineWithdraw = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineWithdrawButton"]',
		);
		const storedQuantity = document.querySelector<HTMLElement>(
			'[data-ui="TileLineInputStoredQuantity"]',
		);

		expect(inputWithdraw).not.toBeNull();
		expect(lineWithdraw).not.toBeNull();
		expect(lineWithdraw?.closest("section")?.querySelector("h4")?.textContent).toBe("Inputs");
		expect(storedQuantity?.previousElementSibling?.contains(inputWithdraw ?? null)).toBe(true);

		await act(async () => inputWithdraw?.click());

		expect(commands.withdraw).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
			lineId: "line:first",
			inputIndex: 0,
		});
		await act(async () => lineWithdraw?.click());
		expect(commands.withdraw).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
			lineId: "line:first",
		});

		await rerender({
			...filledProjection,
			line: [
				{
					...filledProjection.line[0],
					input: [
						{
							...filledProjection.line[0].input[0],
							storedQuantity: 0,
							canWithdraw: false,
						},
					],
				},
			],
		});
		expect(document.querySelector('[data-ui="TileLineInputWithdrawButton"]')).toBeNull();
		expect(document.querySelector('[data-ui="TileLineWithdrawButton"]')).toBeNull();
	});
	it("retains exact buffered-input withdrawal when a live line becomes unavailable", async () => {
		const { container } = await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-max-count",
							itemId: "item:tree",
							itemTitle: "Tree",
							liveQuantity: 1,
							reservedQuantity: 1,
							maxCount: 1,
							messageAfterTitle: "limit reached (1/1).",
							message: "Tree limit reached (2/1).",
						},
					},
					actions: {
						enqueue: {
							enabled: false,
						},
						canWithdraw: true,
					},
					input: [
						{
							...input,
							missingQuantity: 0,
							storedQuantity: 1,
							canWithdraw: true,
						},
					],
				},
			],
		});
		await selectAvailabilityFilter(container, "all");

		expect(
			document.querySelector('[data-ui="TileLineUnavailableReason"]')?.textContent,
		).toContain("Tree limit reached");
		expect(
			document.querySelector('[data-ui="TileLineUnavailableReason"] strong')?.textContent,
		).toBe("Tree");
		expect(
			document.querySelector('[data-ui="TileLineUnavailableReason"]')?.textContent,
		).toContain("1/1");
		expect(
			document.querySelector('[data-ui="TileLineUnavailableReason"]')?.textContent,
		).not.toContain("2/1");
		expect(document.querySelector('[data-ui="TileLineFlowChevron"]')).toBeNull();
		expect(document.querySelector('[data-ui="TileLineUnavailableWithdrawals"]')).not.toBeNull();
		const withdraw = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputWithdrawButton"]',
		);
		expect(withdraw?.disabled).toBe(false);
		await act(async () => withdraw?.click());
		expect(commands.withdraw).toHaveBeenCalledWith({
			ownerItemId: "runtime:producer",
			lineId: "line:first",
			inputIndex: 0,
		});
	});
	it("distinguishes a candidate-only max-count block from a reached live limit", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-max-count",
							itemId: "item:tree",
							itemTitle: "Tree",
							liveQuantity: 0,
							reservedQuantity: 1,
							maxCount: 1,
							messageAfterTitle: "would exceed limit (0/1 currently).",
							message: "Tree limit reached (1/1).",
						},
					},
					actions: {
						enqueue: {
							enabled: false,
						},
						canWithdraw: false,
					},
				},
			],
		});

		const reason = document.querySelector('[data-ui="TileLineUnavailableReason"]');
		expect(reason?.textContent).toContain("Tree would exceed limit (0/1 currently).");
		expect(reason?.querySelectorAll("strong")).toHaveLength(1);
		expect(reason?.querySelector("strong")?.textContent).toBe("Tree");
	});
	it("shows the authored hint instead of exposing rule internals", async () => {
		const dependency = {
			...projection.line[0],
			availability: {
				kind: "unavailable",
				reason: {
					kind: "line-disabled",
					cause: {
						kind: "enable-rule",
						hint: "Build a stonemason first.",
						ruleIndex: 0,
						whenIndex: 0,
						condition: {
							kind: "exists",
							locationLabel: "Board · close",
							selector: {
								kind: "item",
								label: "Stonemason I",
							},
							detail: {
								itemId: "stonemason",
								title: "Stonemason I",
								sourceUrl: "resource:stonemason",
								detailItemId: "runtime:stonemason",
							},
						},
					},
					message: "Build a stonemason first.",
				},
			},
			actions: {
				enqueue: {
					enabled: false,
				},
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		await renderLines({
			...projection,
			line: [
				dependency,
			],
		});
		const reason = document.querySelector('[data-ui="TileLineUnavailableReason"]');
		expect(reason?.textContent).toBe("Build a stonemason first.");
		expect(document.querySelector('[data-ui="TileLineUnavailableDependencyLink"]')).toBeNull();
	});
});
