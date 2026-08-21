// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { act } from "react";

import {
	__fixture_control as control,
	depositInput,
	projection,
	renderLines,
} from "./ItemLinesTab.test/fixture";

describe("ItemLinesTab / deposit inputs", () => {
	it("renders the summed live charge pool for a deposit input", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...depositInput,
							availableChargesLabel: "41",
						},
					],
				},
			],
		});

		expect(document.querySelector('[data-input-kind="deposit"]')?.textContent).toContain(
			"41 available",
		);
		expect(document.querySelector('[data-input-kind="deposit"]')?.textContent).not.toContain(
			"33 available",
		);
	});
	it("shows only deposit availability without repeating its requirement or target title", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...depositInput,
							requiredCharges: 2,
							availableCharges: 1,
							availableChargesLabel: "1",
						},
					],
				},
			],
		});

		const deposit = document.querySelector('[data-input-kind="deposit"]');
		expect(deposit?.textContent).toContain("1 available");
		expect(deposit?.textContent).not.toContain("2 /");
		expect(deposit?.textContent?.match(/Tree/g)).toHaveLength(1);
	});
	it("renders a missing deposit target as a human state instead of a malformed fraction", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...depositInput,
							availableCharges: 0,
							availableChargesLabel: "None",
							targetTitles: [],
						},
					],
				},
			],
		});

		const input = document.querySelector('[data-input-kind="deposit"]');
		expect(input?.textContent).toContain("None available");
		expect(input?.textContent).not.toContain("1 / None available");
	});
	it("renders a missing deposit dependency with canonical availability and opens its detail", async () => {
		await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					availability: {
						kind: "unavailable",
						reason: {
							kind: "deposit-target-missing",
							selector: {
								kind: "item",
								label: "Tree",
							},
							distance: "close",
							detail: {
								itemId: "tree",
								title: "Tree",
								sourceUrl: "resource:tree",
								detailItemId: "runtime:tree",
							},
							messageBeforeDetail: "Requires ",
							messageAfterDetail: " · None available (Board · close).",
							message: "Requires Tree · None available (Board · close).",
						},
					},
					actions: {
						enqueue: {
							enabled: false,
						},
						canWithdraw: false,
					},
					input: [
						{
							...depositInput,
							availableCharges: 0,
							availableChargesLabel: "None",
							targetTitles: [],
							ready: false,
						},
					],
				},
			],
		});

		expect(document.querySelector('[data-input-kind="deposit"]')).toBeNull();
		const reason = document.querySelector('[data-ui="TileLineUnavailableReason"]');
		expect(reason?.textContent).toBe("TreeRequired · None available (Board · close)");
		expect(reason?.textContent).not.toContain("1 / None available");
		const link = reason?.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineUnavailableDependencyLink"]',
		);
		expect(link?.querySelector("img")?.getAttribute("src")).toBe("resource:tree");
		await act(async () => link?.click());
		expect(control.openItemDetailFx).toHaveBeenCalledWith({
			itemId: "runtime:tree",
		});
	});
});
