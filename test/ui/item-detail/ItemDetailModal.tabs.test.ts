// @vitest-environment jsdom

import { Effect } from "effect";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";

import {
	currentRuntime,
	game,
	openItemDetail,
	renderItemDetail,
} from "./ItemDetailModal.test/fixture";
describe("ItemDetailModal / tab lifecycle", () => {
	it("keeps one modal and exact target mounted while switching supported tabs", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		const origin = document.createElement("button");
		document.body.append(origin);

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
				origin,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		const openState = readControl().state;
		if (openState.phase !== "open") throw new Error("Missing open Item Detail state.");
		expect(modal).not.toBeNull();
		expect(modal?.dataset.runtimeId).toBe(owner.id);
		expect(modal?.dataset.tab).toBe("lines");
		expect(document.querySelector('[data-ui="ItemLinesTab"]')).not.toBeNull();
		const contentScene = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailContentScene"]',
		);
		const header = document.querySelector<HTMLElement>("header");
		const headerArtwork = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailHeaderArtwork"]',
		);
		const tabs = document.querySelector<HTMLElement>('[data-ui="ItemDetailTabs"]');
		const linesBody = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailContentTransition"]',
		);
		const closeButton = document.querySelector<HTMLButtonElement>(
			'[data-ui="ItemDetailCloseButton"]',
		);
		expect(contentScene).not.toBeNull();
		expect(header).not.toBeNull();
		expect(headerArtwork).not.toBeNull();
		expect(tabs).not.toBeNull();
		expect(linesBody?.dataset.tab).toBe("lines");
		expect(closeButton?.innerHTML).toContain("size-10");
		expect(
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-ui="ItemDetailTabs"] button'),
			).map((tab) => tab.dataset.tab),
		).toEqual([
			"lines",
			"queue",
			"info",
		]);
		const renderedLineCount = document.querySelectorAll('[data-ui="TileLine"]').length;
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailTabCount"]')?.textContent,
		).toBe(String(renderedLineCount));

		const linesSearch = document.querySelector<HTMLInputElement>(
			'[aria-label="Search visible lines"]',
		);
		if (linesSearch === null) throw new Error("Missing Lines search input.");
		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (valueSetter === undefined) throw new Error("Expected native input value setter.");
		await act(async () => {
			valueSetter.call(linesSearch, "definitely-no-line");
			linesSearch.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		expect(document.querySelectorAll('[data-ui="TileLine"]')).toHaveLength(0);
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailTabCount"]')?.textContent,
		).toBe(String(renderedLineCount));

		const infoTab = document.querySelector<HTMLButtonElement>('[data-tab="info"]');
		if (infoTab === null) throw new Error("Missing Info tab.");
		await act(async () => infoTab.click());
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(document.querySelector('[data-ui="ItemDetailContentScene"]')).toBe(contentScene);
		expect(document.querySelector("header")).toBe(header);
		expect(document.querySelector('[data-ui="ItemDetailHeaderArtwork"]')).toBe(headerArtwork);
		expect(document.querySelector('[data-ui="ItemDetailTabs"]')).toBe(tabs);
		expect(document.querySelector('[data-ui="ItemDetailCloseButton"]')).toBe(closeButton);
		expect(modal?.dataset.tab).toBe("info");
		expect(document.querySelector('[data-ui="ItemInfoTab"]')).not.toBeNull();
		const infoBody = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailContentTransition"]',
		);
		expect(infoBody).not.toBe(linesBody);
		expect(infoBody?.dataset.tab).toBe("info");
		expect(document.querySelectorAll('[data-ui="ItemDetailContentTransition"]')).toHaveLength(
			1,
		);

		const queueTab = document.querySelector<HTMLButtonElement>('[data-tab="queue"]');
		if (queueTab === null) throw new Error("Missing Queue tab.");
		await act(async () => queueTab.click());
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(document.querySelector('[data-ui="ItemDetailContentScene"]')).toBe(contentScene);
		expect(document.querySelector("header")).toBe(header);
		expect(document.querySelector('[data-ui="ItemDetailHeaderArtwork"]')).toBe(headerArtwork);
		expect(document.querySelector('[data-ui="ItemDetailTabs"]')).toBe(tabs);
		expect(document.querySelector('[data-ui="ItemDetailCloseButton"]')).toBe(closeButton);
		expect(modal?.dataset.tab).toBe("queue");
		expect(document.querySelector('[data-ui="ItemQueueTab"]')).not.toBeNull();
		const queueBody = document.querySelector<HTMLElement>(
			'[data-ui="ItemDetailContentTransition"]',
		);
		expect(queueBody).not.toBe(infoBody);
		expect(queueBody?.dataset.tab).toBe("queue");
		expect(document.querySelectorAll('[data-ui="ItemDetailContentTransition"]')).toHaveLength(
			1,
		);
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: openState.generation,
			target: {
				itemId: owner.id,
				tab: "queue",
				origin,
			},
		});

		const linesTab = document.querySelector<HTMLButtonElement>('[data-tab="lines"]');
		if (linesTab === null) throw new Error("Missing Lines tab.");
		await act(async () => {
			infoTab.click();
			linesTab.click();
			infoTab.click();
		});
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBe(modal);
		expect(document.querySelector('[data-ui="ItemDetailContentScene"]')).toBe(contentScene);
		expect(document.querySelector("header")).toBe(header);
		expect(document.querySelector('[data-ui="ItemDetailTabs"]')).toBe(tabs);
		expect(document.querySelectorAll('[data-ui="ItemDetailContentTransition"]')).toHaveLength(
			1,
		);
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailContentTransition"]')?.dataset
				.tab,
		).toBe("info");
		expect(document.querySelector('[data-ui="ItemInfoTab"]')).not.toBeNull();
		expect(readControl().state).toMatchObject({
			phase: "open",
			generation: openState.generation,
			target: {
				itemId: owner.id,
				tab: "info",
				origin,
			},
		});
	});
	it("allows tab switches while pending work settles against its command key", async () => {
		const { readControl } = await renderItemDetail();
		const owner = currentRuntime.items.find((item) => item.item.id === "workshop");
		if (owner === undefined) throw new Error("Missing Workshop runtime item.");
		let rejectRun: ((cause: Error) => void) | undefined;
		const pendingRun = new Promise<never>((_resolve, reject) => {
			rejectRun = reject;
		});
		const runFx = vi.spyOn(game, "runFx").mockImplementationOnce((() =>
			Effect.tryPromise({
				try: () => pendingRun,
				catch: (cause) => cause,
			})) as GameEngine["runFx"]);

		await act(async () => {
			openItemDetail(readControl(), {
				itemId: owner.id,
			});
			await Promise.resolve();
			await Promise.resolve();
		});
		const setDefault = document.querySelector<HTMLButtonElement>(
			'[data-ui="TileLineSetDefaultButton"]',
		);
		if (setDefault === null) throw new Error("Missing Set default button.");

		await act(async () => {
			setDefault.click();
			await Promise.resolve();
		});
		expect(setDefault.disabled).toBe(false);
		expect(setDefault.textContent).toBe("Saving…");
		expect(runFx).toHaveBeenCalledTimes(1);

		const infoTab = document.querySelector<HTMLButtonElement>('[data-tab="info"]');
		if (infoTab === null) throw new Error("Missing Info tab.");
		await act(async () => infoTab.click());
		expect(readControl().state).toMatchObject({
			target: {
				tab: "info",
			},
		});
		expect(document.querySelector('[data-ui="TileLineSetDefaultButton"]')).toBeNull();

		await act(async () => {
			rejectRun?.(new Error("Deferred default failure."));
			await Promise.resolve();
			await Promise.resolve();
		});
		const linesTab = document.querySelector<HTMLButtonElement>('[data-tab="lines"]');
		if (linesTab === null) throw new Error("Missing Lines tab.");
		await act(async () => linesTab.click());
		expect(
			document.querySelector<HTMLButtonElement>('[data-ui="TileLineSetDefaultButton"]')
				?.disabled,
		).toBe(false);
		expect(document.querySelector('[data-ui="TileLine"]')?.textContent).toContain(
			"Deferred default failure.",
		);
	});
});
