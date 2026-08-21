// @vitest-environment jsdom

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";
import {
	line,
	projection,
	renderLines,
	selectAvailabilityFilter,
} from "./ItemLinesTab.test/fixture";

describe("ItemLinesTab / availability membership", () => {
	it("defaults to Available and keeps input-starved lines while hiding unavailable lines", async () => {
		const inputStarved = {
			...line({
				lineId: "line:inputs",
				title: "Needs Water",
			}),
			availability: {
				kind: "available",
				readiness: "inputs",
			},
			actions: {
				enqueue: {
					enabled: true,
				},
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		const unavailable = {
			...line({
				lineId: "line:capped",
				title: "Capped Well",
			}),
			availability: {
				kind: "unavailable",
				reason: {
					kind: "direct-output-max-count",
					itemId: "well",
					itemTitle: "Well",
					liveQuantity: 1,
					reservedQuantity: 0,
					maxCount: 1,
					messageAfterTitle: "limit reached (1/1).",
					message: "Well limit reached (1/1).",
				},
			},
			actions: {
				enqueue: {
					enabled: false,
				},
				canWithdraw: false,
			},
		} as const satisfies useItemDetailLines.Line;
		const downstreamUnavailable = {
			...unavailable,
			lineId: "line:downstream-capped",
			title: "Capped Blueprint",
			availability: {
				kind: "unavailable",
				reason: {
					kind: "downstream-output-max-count",
					intermediateItemId: "well-blueprint",
					intermediateItemTitle: "Well Blueprint",
					itemId: "well",
					itemTitle: "Well",
					liveQuantity: 1,
					reservedQuantity: 0,
					maxCount: 1,
					messageAfterTitle: "limit reached (1/1).",
					message: "Well limit reached (1/1).",
				},
			},
		} as const satisfies useItemDetailLines.Line;
		const mixed = {
			...projection,
			line: [
				unavailable,
				inputStarved,
				downstreamUnavailable,
				projection.line[0],
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { container } = await renderLines(mixed);
		const available = container.querySelector<HTMLInputElement>(
			'input[name="item-lines-availability"][value="available"]',
		);
		const all = container.querySelector<HTMLInputElement>(
			'input[name="item-lines-availability"][value="all"]',
		);

		expect(
			container
				.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')
				?.getAttribute("role"),
		).toBe("radiogroup");
		expect(available?.checked).toBe(true);
		expect(all?.checked).toBe(false);
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:inputs",
			"line:first",
		]);
		expect(container.textContent).toContain("Needs Water");
		expect(container.textContent).not.toContain("Capped Well");
		expect(container.textContent).not.toContain("Capped Blueprint");

		await selectAvailabilityFilter(container, "all");
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:capped",
			"line:inputs",
			"line:downstream-capped",
			"line:first",
		]);
		expect(
			container.querySelector('[data-line-id="line:capped"] [data-ui="TileLineStatusBadge"]')
				?.textContent,
		).toBe("Disabled");
		expect(
			container.querySelector('[data-line-id="line:inputs"] [data-ui="TileLineStatusBadge"]'),
		).toBeNull();
	});
	it("keeps a running job in Available when its line becomes unavailable", async () => {
		const runningUnavailable = {
			...line({
				active: true,
				lineId: "line:running-disabled",
				title: "Running Disabled",
			}),
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
		const { container } = await renderLines({
			...projection,
			line: [
				runningUnavailable,
			],
		});
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:running-disabled",
		]);
		expect(container.textContent).toContain("Running Disabled");
		expect(container.textContent).not.toContain("This line is currently disabled.");
		expect(container.querySelector('[data-ui="TileLineUnavailableReason"]')).toBeNull();
		expect(container.querySelector('[data-ui="TileLineReadinessBadge"]')).toBeNull();
		expect(container.querySelector('[data-ui="TileLineStatusBadge"]')).toBeNull();
		expect(container.querySelector('[data-ui="TileLineInput"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="TileLineOutputItem"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="TileLineFlowChevron"]')).not.toBeNull();
		expect(
			container.querySelector<HTMLButtonElement>('[data-ui="TileLineInputDetailLink"]')
				?.disabled,
		).toBe(true);
		expect(
			container.querySelector<HTMLButtonElement>('[data-ui="TileLineOutputDetailLink"]')
				?.disabled,
		).toBe(true);
	});
});
