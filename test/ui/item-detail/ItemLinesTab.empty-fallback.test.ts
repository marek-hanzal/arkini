// @vitest-environment jsdom

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import { projection, renderLines, selectAvailabilityFilter } from "./ItemLinesTab.test/fixture";

describe("ItemLinesTab / empty availability fallback", () => {
	it("automatically selects All when Available becomes empty without switching back in a loop", async () => {
		const unavailable = {
			...projection.line[0],
			availability: {
				kind: "unavailable",
				reason: {
					kind: "line-disabled",
					cause: {
						kind: "static",
					},
					message: "This line is currently disabled.",
				},
			},
			actions: {
				enqueue: {
					enabled: false,
				},
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		const unavailableProjection = {
			...projection,
			line: [
				unavailable,
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const mixedProjection = {
			...projection,
			line: [
				unavailable,
				...projection.line,
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { container, rerender } = await renderLines(projection);
		const available = () =>
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="available"]',
			);
		const all = () =>
			container.querySelector<HTMLInputElement>(
				'input[name="item-lines-availability"][value="all"]',
			);

		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();

		await rerender(unavailableProjection);
		expect(available()?.checked).toBe(false);
		expect(available()?.disabled).toBe(true);
		expect(available()?.closest("label")?.dataset.disabled).toBe("true");
		expect(all()?.checked).toBe(true);
		expect(container.querySelector('[data-ui="ItemLinesAvailableEmpty"]')).toBeNull();
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(1);

		await rerender(projection);
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(2);

		await rerender(mixedProjection);
		expect(available()?.checked).toBe(false);
		expect(available()?.disabled).toBe(false);
		expect(all()?.checked).toBe(true);
		await selectAvailabilityFilter(container, "available");
		expect(available()?.checked).toBe(true);
		await rerender(unavailableProjection);
		expect(available()?.checked).toBe(false);
		expect(all()?.checked).toBe(true);
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(1);
		expect(container.textContent).toContain("This line is currently disabled.");
	});
	it("selects All once for an owner with no visible lines and keeps the canonical empty state", async () => {
		const { container } = await renderLines({
			...projection,
			line: [],
		});

		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		expect(container.querySelector('[data-ui="ItemLinesVisibleEmpty"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="ItemLinesAvailableEmpty"]')).toBeNull();
		expect(container.textContent).toContain("No product line is currently visible.");
		expect(container.textContent).not.toContain("Choose All");
	});
});
