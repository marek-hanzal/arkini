// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it } from "vitest";

import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

import {
	currentRuntime,
	openItemDetail,
	publishRuntime,
	renderItemDetail,
} from "./ItemDetailModal.test/fixture";
describe("ItemDetailModal / stale detail", () => {
	it("retains stale Sources navigation when the inspected target disappears", async () => {
		const { readControl } = await renderItemDetail();
		const target = currentRuntime.items.find((item) => item.item.id === "water");
		if (target === undefined) throw new Error("Missing target fixture.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: target.id,
				tab: "sources",
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemSource"]')).not.toBeNull();

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.filter((item) => item.id !== target.id),
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemSource"]')).not.toBeNull();
		const sourceLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemSourceDetailLink"]',
		);
		expect(sourceLink?.disabled).toBe(false);
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).not.toContain(
			"Space 1",
		);
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailContentScene"]')?.dataset
				.stale,
		).toBe("true");
	});
	it("keeps retained navigation and search while removing stale facts and commands", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		expect(modal).not.toBeNull();

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.filter((item) => item.id !== owner.id),
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(readControl().state.phase).toBe("open");
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailContentScene"]')?.dataset
				.stale,
		).toBe("true");
		expect(document.body.textContent).toContain("This item no longer exists");
		expect(
			Array.from(
				document.querySelectorAll<HTMLButtonElement>('[data-ui="ItemDetailTabs"] button'),
			).every((button) => !button.disabled),
		).toBe(true);
		expect(document.querySelector('[data-ui="TileLineRuntime"]')).toBeNull();
		expect(document.querySelector('[data-ui="TileLineProgress"]')).toBeNull();
		expect(document.querySelector('[data-ui="ItemLinesAvailabilityFilter"]')).toBeNull();
		const retainedReferences = Array.from(
			document.querySelectorAll<HTMLButtonElement>(
				'[data-ui="TileLineInputDetailLink"], [data-ui="TileLineOutputDetailLink"]',
			),
		);
		expect(retainedReferences.length).toBeGreaterThan(0);
		expect(retainedReferences.every((button) => !button.disabled)).toBe(true);
		expect(
			document.querySelector<HTMLButtonElement>('[data-ui="ItemDetailCloseButton"]')
				?.disabled,
		).toBe(false);

		const staleSearch = document.querySelector<HTMLInputElement>(
			'[aria-label="Search visible lines"]',
		);
		if (staleSearch === null) throw new Error("Missing retained Lines search input.");
		expect(staleSearch.disabled).toBe(false);
		const staleValueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (staleValueSetter === undefined) throw new Error("Expected native input value setter.");
		await act(async () => {
			staleValueSetter.call(staleSearch, "definitely-no-line");
			staleSearch.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		expect(document.querySelector('[data-ui="ItemLinesSearchEmpty"]')).not.toBeNull();

		const infoTab = document.querySelector<HTMLButtonElement>('[data-tab="info"]');
		if (infoTab === null) throw new Error("Missing retained Info tab.");
		await act(async () => {
			infoTab.click();
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemInfoTab"]')).not.toBeNull();
		expect(document.querySelector('[data-label="Location"]')).toBeNull();
		expect(document.querySelector('[data-label="Current stack"]')).toBeNull();
		expect(document.querySelector('[data-label="Owned"]')).toBeNull();
		expect(document.querySelector('[data-label="Charges"]')).toBeNull();
		expect(document.querySelector('[data-label="Type"]')).not.toBeNull();

		const queueTab = document.querySelector<HTMLButtonElement>('[data-tab="queue"]');
		if (queueTab === null) throw new Error("Missing retained Queue tab.");
		await act(async () => {
			queueTab.click();
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="ItemQueueStale"]')).not.toBeNull();
		expect(document.querySelector('[data-ui="ItemQueueRow"]')).toBeNull();
	});
});
