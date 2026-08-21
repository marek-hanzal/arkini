// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";

import {
	input,
	line,
	projection,
	renderLines,
	selectAvailabilityFilter,
	setSearchQuery,
} from "./ItemLinesTab.test/fixture";

describe("ItemLinesTab / search", () => {
	it("searches all lines when navigation provides an initial query", async () => {
		const { container } = await renderLines(projection, "Log");

		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("Log");
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
	});
	it("searches unavailable source lines initially and preserves the query across subsets", async () => {
		const unavailable = {
			...line({
				lineId: "line:capped",
				title: "Capped Well",
			}),
			description: "Limited production line.",
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
		const mixed = {
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
		const { container } = await renderLines(mixed, "well limit");

		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("well limit");
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:capped",
		]);

		await selectAvailabilityFilter(container, "available");
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(0);
		expect(container.querySelector('[data-ui="ItemLinesSearchEmpty"]')).not.toBeNull();

		await selectAvailabilityFilter(container, "all");
		await setSearchQuery(container, "");
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:capped",
			"line:first",
			"line:second",
		]);
	});
	it("preserves local search for the same owner and resets it for an exact owner change", async () => {
		const { container, rerender } = await renderLines(projection);
		await setSearchQuery(container, "first");

		await rerender({
			...projection,
			line: projection.line.map((candidate) => ({
				...candidate,
				description: `${candidate.description} Live update.`,
			})),
		});
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("first");

		await rerender({
			...projection,
			itemId: "runtime:other-producer",
		});
		expect(container.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		expect(
			container.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("");
	});
	it("filters authoritative visible lines by semantic facts without indexing volatile numbers", async () => {
		const advancedInput = {
			...input,
			selector: {
				kind: "item",
				label: "Knowledge Advanced",
			},
			detail: undefined,
			ready: false,
		} as const satisfies useItemDetailLines.Input;
		const advancedOutput = {
			weight: 1,
			roll: [
				{
					kind: "chance",
					chance: 0.65,
					item: [
						{
							itemId: "item:plank",
							title: "Plank",
							quantity: {
								min: 1,
								max: 4,
							},
							activeRuleHints: [],
						},
					],
				},
			],
		} as const satisfies useItemDetailLines.OutputSet;
		const searchable = {
			...projection,
			line: [
				projection.line[0],
				{
					...projection.line[1],
					title: "Advanced Knowledge",
					description: "Studies arcane production methods.",
					availability: {
						kind: "available",
						readiness: "inputs",
					},
					input: [
						advancedInput,
					],
					output: [
						advancedOutput,
					],
				},
			],
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		const { container } = await renderLines(searchable);

		expect(container.querySelector('[data-ui="ItemLinesSearch"]')).not.toBeNull();
		expect(
			container
				.querySelector('[data-ui="ItemLinesTab"]')
				?.querySelector('[data-ui="Scrollable"]'),
		).not.toBeNull();

		for (const query of [
			"arcane",
			"knowledge advanced",
			"item:plank",
			"missing inputs",
		]) {
			await setSearchQuery(container, query);
			expect(
				Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
					(row) => row.dataset.lineId,
				),
			).toEqual([
				"line:second",
			]);
		}

		await setSearchQuery(container, "500");
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(0);
		expect(container.querySelector('[data-ui="ItemLinesSearchEmpty"]')?.textContent).toContain(
			"No visible lines match “500”.",
		);

		await setSearchQuery(container, "");
		expect(
			Array.from(container.querySelectorAll<HTMLElement>('[data-ui="TileLine"]')).map(
				(row) => row.dataset.lineId,
			),
		).toEqual([
			"line:first",
			"line:second",
		]);
	});
	it("resolves searched identities against the latest live line projection", async () => {
		const { container, rerender } = await renderLines(projection);
		await setSearchQuery(container, "running");
		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(1);
		expect(container.textContent).toContain("0.5 s");

		const updated = {
			...projection,
			line: projection.line.map((candidate) =>
				candidate.lineId === "line:second" && candidate.activeJob !== undefined
					? {
							...candidate,
							activeJob: {
								...candidate.activeJob,
								remainingMs: 200,
							},
						}
					: candidate,
			),
		} as const satisfies Extract<
			useItemDetailLines.Projection,
			{
				kind: "available";
			}
		>;
		await rerender(updated);

		expect(container.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(1);
		expect(container.textContent).toContain("0.2 s");
	});
});
