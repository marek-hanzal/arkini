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
describe("ItemDetailModal / definition detail", () => {
	it("keeps output recipes definition scoped even when a live item exists", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		const output = currentRuntime.items.find((item) => item.item.id === "water");
		if (owner === undefined || output === undefined)
			throw new Error("Missing detail fixtures.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		const shellGeneration = readControl().state;
		if (modal === null || shellGeneration.phase !== "open") {
			throw new Error("Missing open Item Detail modal.");
		}
		const outputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineOutputDetailLink"][data-detail-available="true"]',
		);
		if (outputLink === null) throw new Error("Missing clickable output artwork.");

		await act(async () => {
			outputLink.click();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: shellGeneration.generation,
			target: {
				kind: "definition",
				itemId: "water",
				tab: "sources",
			},
		});
		expect(modal.dataset.runtimeId).toBeUndefined();
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain("Workshop");
		expect(
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-ui="ItemDetailTabs"] button'),
			).map((tab) => tab.dataset.tab),
		).toEqual([
			"sources",
			"info",
		]);

		const infoTab = document.querySelector<HTMLButtonElement>('[data-tab="info"]');
		if (infoTab === null) throw new Error("Missing definition Info tab.");
		await act(async () => {
			infoTab.click();
			await Promise.resolve();
		});
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: shellGeneration.generation,
			target: {
				kind: "definition",
				itemId: "water",
				tab: "info",
			},
		});
		expect(modal.dataset.runtimeId).toBeUndefined();
		expect(document.querySelector('[data-ui="ItemDefinitionInfoTab"]')).not.toBeNull();
	});
	it("keeps the modal shell stable when an output has only configured definition detail", async () => {
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		publishRuntime(
			RuntimeSchema.parse({
				...currentRuntime,
				items: currentRuntime.items.filter((item) => item.item.id !== "water"),
			}),
		);
		const { readControl } = await renderItemDetail();

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		if (modal === null) throw new Error("Missing Item Detail modal.");
		const outputLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineOutputDetailLink"][data-detail-available="true"]',
		);
		if (outputLink === null) throw new Error("Missing configured output detail link.");

		await act(async () => {
			outputLink.click();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(readControl().state).toMatchObject({
			phase: "open",
			target: {
				kind: "definition",
				itemId: "water",
				tab: "sources",
			},
		});
		expect(modal.dataset.targetKind).toBe("definition");
		expect(modal.dataset.runtimeId).toBeUndefined();
		expect(modal.dataset.tab).toBe("sources");
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain("Workshop");
	});
});
