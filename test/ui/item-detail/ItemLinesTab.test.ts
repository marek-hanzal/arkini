// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { act } from "react";

import {
	animationFrames,
	__fixture_control as control,
	flushAnimationFrame,
	input,
	projection,
	rect,
	renderLines,
} from "./ItemLinesTab.test/fixture";

describe("ItemLinesTab / focus and navigation", () => {
	it("auto-focuses one projected work row once per Lines visit", async () => {
		const focused = {
			...projection,
			focusLineId: "line:second",
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { container, rerender } = await renderLines(focused);
		const scrollable = container.querySelector<HTMLElement>('[data-ui="Scrollable"]');
		const row = container.querySelector<HTMLElement>('[data-line-id="line:second"]');
		if (scrollable === null || row === null) throw new Error("Missing focused line geometry.");

		await flushAnimationFrame();
		expect(scrollable.scrollTop).toBe(0);
		expect(animationFrames.size).toBe(1);

		scrollable.getBoundingClientRect = () =>
			rect({
				top: 0,
				bottom: 100,
			});
		row.getBoundingClientRect = () =>
			rect({
				top: 120,
				bottom: 160,
			});

		await flushAnimationFrame();
		expect(scrollable.scrollTop).toBe(72);

		scrollable.scrollTop = 11;
		await rerender({
			...focused,
			focusLineId: "line:first",
			line: focused.line.map((line) =>
				line.lineId === "line:second" && line.activeJob !== undefined
					? {
							...line,
							activeJob: {
								...line.activeJob,
								remainingMs: 250,
							},
						}
					: line,
			),
		});
		await flushAnimationFrame();
		expect(scrollable.scrollTop).toBe(11);
	});
	it("cancels a stale pending focus when the exact owner changes", async () => {
		const { container, rerender } = await renderLines({
			...projection,
			focusLineId: "line:second",
		});
		await rerender({
			...projection,
			itemId: "runtime:new-owner",
			focusLineId: "line:first",
		});
		const scrollable = container.querySelector<HTMLElement>('[data-ui="Scrollable"]');
		const first = container.querySelector<HTMLElement>('[data-line-id="line:first"]');
		if (scrollable === null || first === null) throw new Error("Missing replacement geometry.");
		scrollable.getBoundingClientRect = () =>
			rect({
				top: 0,
				bottom: 100,
			});
		first.getBoundingClientRect = () =>
			rect({
				top: 120,
				bottom: 160,
			});

		await flushAnimationFrame();
		expect(scrollable.scrollTop).toBe(72);
		expect(animationFrames.size).toBe(0);
	});
	it("opens exact input runtime detail and configured output detail from subtle artwork links", async () => {
		await renderLines();
		const inputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputDetailLink"]',
		);
		const outputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineOutputDetailLink"]',
		);
		if (inputLink === null || outputLink === null) throw new Error("Missing item links.");

		expect(inputLink.disabled).toBe(false);
		expect(outputLink.disabled).toBe(false);

		await act(async () => inputLink.click());
		expect(control.openItemDetailFx).toHaveBeenCalledWith({
			itemId: "runtime:tree",
		});

		await act(async () => outputLink.click());
		expect(control.openItemDefinitionDetailFx).toHaveBeenCalledWith({
			itemId: "log",
		});
	});
	it("shows autofill material truth and opens the first producer with a material filter", async () => {
		const { rerender } = await renderLines({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...input,
							autofillAvailableQuantity: 4,
						},
					],
				},
			],
		});

		const availability = document.querySelector<HTMLElement>(
			'[data-ui="TileLineInputAutofillAvailability"]',
		);
		expect(availability?.textContent).toBe("4 available");
		expect(document.querySelector('[data-ui="TileLineInputProducerLink"]')).toBeNull();

		await rerender({
			...projection,
			line: [
				{
					...projection.line[0],
					input: [
						{
							...input,
							autofillAvailableQuantity: 0,
							producerItemId: "runtime:lumber-yard",
						},
					],
				},
			],
		});
		const producerLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineInputProducerLink"]',
		);
		expect(producerLink?.textContent).toBe("None");

		await act(async () => producerLink?.click());
		expect(control.openItemDetailFx).toHaveBeenCalledWith({
			itemId: "runtime:lumber-yard",
			linesSearchQuery: "Tree",
			origin: producerLink,
			tab: "lines",
		});
	});
});
