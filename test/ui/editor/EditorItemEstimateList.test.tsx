// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorItemEstimateList } from "~/ui/item/editor/EditorItemEstimateList";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	estimateState: undefined as unknown,
	project: undefined as unknown,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/item/editor/useEditorItemEstimateIndex", () => ({
	useEditorItemEstimateIndex: () => state.estimateState,
}));

vi.mock("~/ui/item/editor/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () =>
		createElement("span", {
			"data-ui": "EditorItemThumbnail",
		}),
}));

vi.mock("~/ui/button/Button", () => ({
	ButtonLink: ({ children, className, params, to }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				className,
				"data-params": JSON.stringify(params),
				"data-to": to,
			},
			children as ReactNode,
		),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

const createItem = (id: string, title: string) => ({
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	description: `${title} description`,
	id,
	title,
	type: "simple",
	uid: id,
});

beforeEach(() => {
	state.project = {
		config: {
			items: {
				bakery: createItem("bakery", "Bakery"),
				water: createItem("water", "Water"),
				well: createItem("well", "Well"),
			},
		},
		projectId: "editor-test",
		title: "Editor test",
	};
	state.estimateState = {
		entries: [
			{
				itemId: "bakery",
				method: "static",
				runtimeMs: 120_000,
				status: "obtainable",
			},
			{
				itemId: "water",
				method: "static",
				runtimeMs: 0,
				status: "obtainable",
			},
			{
				itemId: "well",
				method: "static",
				runtimeMs: 60_000,
				status: "obtainable",
			},
		],
		status: "ready",
	};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderList = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(EditorItemEstimateList));
	});
	return container;
};

const readVisibleItemIds = (container: HTMLElement) =>
	[
		...container.querySelectorAll<HTMLElement>("[data-item-id]"),
	].map((row) => row.dataset.itemId);

const setSearch = async (container: HTMLElement, value: string) => {
	const input = container.querySelector<HTMLInputElement>('[aria-label="Search item estimates"]');
	if (input === null) throw new Error("Missing item estimate search.");
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (setter === undefined) throw new Error("Missing native input value setter.");
	await act(async () => {
		setter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

const setSort = async (container: HTMLElement, value: "fastest" | "slowest") => {
	const select = container.querySelector<HTMLSelectElement>("#editor-item-estimate-sort");
	if (select === null) throw new Error("Missing item estimate sort.");
	const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
	if (setter === undefined) throw new Error("Missing native select value setter.");
	await act(async () => {
		setter.call(select, value);
		select.dispatchEvent(
			new Event("change", {
				bubbles: true,
			}),
		);
	});
};

describe("EditorItemEstimateList", () => {
	it("searches, sorts by estimated runtime, and links each row to its Estimate detail", async () => {
		const container = await renderList();

		expect(readVisibleItemIds(container)).toEqual([
			"water",
			"well",
			"bakery",
		]);
		expect(container.textContent).not.toContain("Expected");
		expect(container.textContent).not.toContain("Guaranteed");
		expect(container.textContent).not.toContain("Best");
		expect(container.textContent).toContain("2 min");
		expect(container.querySelector('[data-ui="EditorItemThumbnail"]')).not.toBeNull();
		expect(container.querySelector('[aria-label^="Filter items by"]')).toBeNull();

		const bakeryLink = container.querySelector<HTMLAnchorElement>('[data-item-id="bakery"] a');
		expect(bakeryLink?.dataset.to).toBe(
			"/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
		);
		expect(bakeryLink?.dataset.params).toContain('"sectionId":"estimate"');

		await setSort(container, "slowest");
		expect(readVisibleItemIds(container)).toEqual([
			"bakery",
			"well",
			"water",
		]);

		await setSearch(container, "well");
		expect(readVisibleItemIds(container)).toEqual([
			"well",
		]);
	});

	it("shows one loading state while the full-project batch is calculated", async () => {
		state.estimateState = {
			entries: [],
			status: "loading",
		};
		const container = await renderList();

		expect(container.querySelector('[data-ui="EditorItemEstimatesLoading"]')).not.toBeNull();
		expect(container.textContent).toContain("Calculating all item estimates…");
		expect(readVisibleItemIds(container)).toEqual([]);
	});
});
