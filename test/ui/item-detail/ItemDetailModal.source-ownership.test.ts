// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it } from "vitest";

import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

import {
	currentRuntime,
	openItemDefinitionDetail,
	openItemDetail,
	publishRuntime,
	renderItemDetail,
} from "./ItemDetailModal.test/fixture";
describe("ItemDetailModal / source ownership", () => {
	it("keeps an owned Source discoverable when its last owner moves off the Board", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		const target = currentRuntime.items.find((item) => item.item.id === "water");
		if (owner === undefined || target === undefined)
			throw new Error("Missing source fixtures.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: target.id,
				tab: "sources",
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		if (modal === null) throw new Error("Missing Item Detail modal.");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((item) =>
						item.id === owner.id
							? {
									...item,
									location: {
										scope: "inventory",
										position: {
											x: 0,
											y: 0,
										},
									},
								}
							: item,
					),
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(modal.dataset.tab).toBe("sources");
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain(
			"Owned source",
		);
		expect(
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-ui="ItemDetailTabs"] button'),
			).map((tab) => tab.dataset.tab),
		).toEqual([
			"sources",
			"info",
		]);

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

		expect(modal.dataset.tab).toBe("info");
		expect(document.querySelector('[data-tab="sources"]')).toBeNull();
	});
	it("removes definition Sources when the player loses the last source owner", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing source fixture.");

		await act(async () => {
			openItemDefinitionDetail(readControl(), {
				itemId: "water",
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		if (modal === null) throw new Error("Missing Item Detail modal.");
		expect(modal.dataset.targetKind).toBe("definition");
		expect(modal.dataset.tab).toBe("sources");

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

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(modal.dataset.targetKind).toBe("definition");
		expect(modal.dataset.tab).toBe("info");
		expect(document.querySelector('[data-ui="ItemSource"]')).toBeNull();
		expect(document.querySelector('[data-tab="sources"]')).toBeNull();
		expect(document.querySelector('[data-ui="ItemDefinitionInfoTab"]')).not.toBeNull();
	});
});
