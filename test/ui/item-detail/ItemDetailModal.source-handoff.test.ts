// @vitest-environment jsdom

import { Deferred, Effect } from "effect";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { currentRuntime, openItemDetail, renderItemDetail } from "./ItemDetailModal.test/fixture";
describe("ItemDetailModal / source handoff", () => {
	it("shows exact owned sources and hands off through the stable modal shell", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		const target = currentRuntime.items.find((item) => item.item.id === "water");
		if (owner === undefined || target === undefined)
			throw new Error("Missing source fixtures.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: target.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		if (modal === null) throw new Error("Missing Item Detail modal.");
		expect(modal.dataset.tab).toBe("sources");
		expect(
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-ui="ItemDetailTabs"] button'),
			).map((tab) => tab.dataset.tab),
		).toEqual([
			"sources",
			"info",
		]);
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain("Workshop");
		expect(document.querySelector('[data-ui="ItemSource"]')?.textContent).toContain("Space 1");
		expect(document.querySelector('[data-ui="ItemSourceLine"]')).toBeNull();

		const sourceLink = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemSourceDetailLink"]',
		);
		if (sourceLink === null) throw new Error("Missing clickable source.");
		await act(async () => {
			sourceLink.click();
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(readControl().state).toMatchObject({
			phase: "open",
			target: {
				kind: "runtime",
				itemId: owner.id,
				tab: "lines",
				linesSearchQuery: "Water",
			},
		});
		expect(document.querySelector('[data-ui="ItemLinesTab"]')).not.toBeNull();
		expect(
			document.querySelector<HTMLInputElement>('[aria-label="Search visible lines"]')?.value,
		).toBe("Water");
	});
	it("closes immediately while an admitted autofill command keeps settling", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
				tab: "lines",
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const settlement = Effect.runSync(Deferred.make<void>());
		await act(async () => {
			readControl().runPendingAction({
				key: "line:autofill",
				action: "autofill",
				failureMessage: "Autofill failed.",
				run: Deferred.await(settlement),
			});
			await Promise.resolve();
		});
		expect(readControl().readPendingAction("line:autofill")).toBe("autofill");

		const closeButton = document.querySelector<HTMLButtonElement>(
			'button[aria-label="Close item detail"]',
		);
		if (closeButton === null) throw new Error("Missing Item Detail close button.");
		expect(closeButton.disabled).toBe(false);
		await act(async () => {
			closeButton.click();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(readControl().state.phase).toBe("closed");
		expect(readControl().readPendingAction("line:autofill")).toBe("autofill");
		await act(async () => {
			Effect.runSync(Deferred.succeed(settlement, undefined));
		});
		await vi.waitFor(() => expect(readControl().readPendingAction("line:autofill")).toBeNull());
		expect(readControl().readPendingAction("line:autofill")).toBeNull();
	});
});
