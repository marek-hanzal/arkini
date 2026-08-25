// @vitest-environment jsdom

import { act, createElement, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorItemEstimateSort } from "~/ui/item/editor/EditorItemEstimateSort";
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
	Button: ({ children, ...props }: Record<string, unknown>) =>
		createElement("button", props, children as ReactNode),
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
				demand: 0.05,
				itemId: "bakery",
				method: "static",
				runtimeMs: 120_000,
				status: "complete",
			},
			{
				demand: 64_429.17,
				itemId: "water",
				method: "static",
				runtimeMs: 0,
				status: "complete",
			},
			{
				demand: 50,
				itemId: "well",
				method: "static",
				status: "partial",
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
	const Harness = () => {
		const [query, setQuery] = useState("");
		const [sort, setSort] = useState<EditorItemEstimateSort>("fastest");
		return createElement(EditorItemEstimateList, {
			onQueryChange: setQuery,
			onSortChange: setSort,
			query,
			sort,
		});
	};
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(Harness));
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

const setSort = async (container: HTMLElement, label: string) => {
	const trigger = container.querySelector<HTMLButtonElement>('[data-ui="EditorSelectTrigger"]');
	if (trigger === null) throw new Error("Missing item estimate sort.");
	await act(async () => {
		trigger.click();
	});
	const option = Array.from(
		document.querySelectorAll<HTMLButtonElement>('[data-ui="EditorSelectOption"]'),
	).find((candidate) => candidate.textContent?.includes(label));
	if (option === undefined) throw new Error(`Missing ${label} sort option.`);
	await act(async () => option.click());
};

describe("EditorItemEstimateList", () => {
	it("searches, sorts by estimated runtime, and links each row to its Estimate detail", async () => {
		const container = await renderList();

		expect(readVisibleItemIds(container)).toEqual([
			"water",
			"bakery",
			"well",
		]);
		expect(container.textContent).not.toContain("Expected");
		expect(container.textContent).not.toContain("Guaranteed");
		expect(container.textContent).not.toContain("Best");
		expect(container.textContent).toContain("2 min");
		expect(container.textContent).toContain("Partial");
		expect(container.textContent).toContain("Estimate:");
		expect(container.textContent).toContain("Demand:");
		expect(container.textContent).toContain("64,429.17 (100%)");
		expect(container.textContent).toContain("0.05 (negligible)");
		expect(container.querySelector('[data-ui="EditorItemThumbnail"]')).not.toBeNull();
		expect(container.querySelector('[aria-label^="Filter items by"]')).toBeNull();
		expect(container.querySelector("select")).toBeNull();
		expect(container.querySelector('[data-ui="EditorSelectTrigger"]')?.textContent).toContain(
			"Fastest first",
		);

		const bakeryLink = container.querySelector<HTMLAnchorElement>('[data-item-id="bakery"] a');
		expect(bakeryLink?.dataset.to).toBe(
			"/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
		);
		expect(bakeryLink?.dataset.params).toContain('"sectionId":"estimate"');

		await setSort(container, "Slowest first");
		expect(readVisibleItemIds(container)).toEqual([
			"bakery",
			"water",
			"well",
		]);

		await setSort(container, "Highest demand first");
		expect(readVisibleItemIds(container)).toEqual([
			"water",
			"well",
			"bakery",
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
