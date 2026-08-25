// @vitest-environment jsdom

import { act, createElement, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorItemEstimateSortSchema } from "~/editor/EditorItemEstimateSortSchema";
import { EditorItemEstimateList } from "~/ui/item/editor/EditorItemEstimateList";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	estimateState: undefined as unknown,
	project: undefined as unknown,
	selection: undefined as
		| {
				readonly incomplete: boolean;
				readonly query: string;
				readonly sort: "demand" | "fastest" | "slowest";
		  }
		| undefined,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/item/editor/useEditorItemEstimateIndex", () => ({
	useEditorItemEstimateIndex: (
		_project: unknown,
		selection: {
			readonly incomplete: boolean;
			readonly query: string;
			readonly sort: "demand" | "fastest" | "slowest";
		},
	) => {
		state.selection = selection;
		return state.estimateState;
	},
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
	const items = {
		bakery: createItem("bakery", "Bakery"),
		water: createItem("water", "Water"),
		well: createItem("well", "Well"),
	};
	state.project = {
		config: {
			items,
		},
		projectId: "editor-test",
		title: "Editor test",
	};
	state.estimateState = {
		maximumDemand: 64_429.17,
		rows: [
			{
				estimate: {
					demand: 0.05,
					itemId: "bakery",
					method: "static",
					runtimeMs: 120_000,
					status: "complete",
				},
				item: items.bakery,
			},
			{
				estimate: {
					demand: 64_429.17,
					itemId: "water",
					method: "static",
					runtimeMs: 0,
					status: "complete",
				},
				item: items.water,
			},
			{
				estimate: {
					demand: 50,
					itemId: "well",
					method: "static",
					status: "partial",
				},
				item: items.well,
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
		const [incomplete, setIncomplete] = useState(false);
		const [query, setQuery] = useState("");
		const [sort, setSort] = useState<EditorItemEstimateSortSchema.Type>("fastest");
		return createElement(EditorItemEstimateList, {
			incomplete,
			onIncompleteChange: setIncomplete,
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

const toggleIncomplete = async (container: HTMLElement) => {
	const filter = container.querySelector<HTMLButtonElement>(
		'[data-ui="EditorItemEstimateIncompleteFilter"]',
	);
	if (filter === null) throw new Error("Missing incomplete estimate filter.");
	await act(async () => filter.click());
};

describe("EditorItemEstimateList", () => {
	it("binds query, incomplete filter, and sort to its data source", async () => {
		const container = await renderList();

		expect(readVisibleItemIds(container)).toEqual([
			"bakery",
			"water",
			"well",
		]);
		expect(state.selection).toEqual({
			incomplete: false,
			query: "",
			sort: "fastest",
		});
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
		expect(
			container.querySelector('[data-ui="EditorItemEstimateIncompleteFilter"]')?.textContent,
		).toContain("Incomplete");
		expect(
			container
				.querySelector('[data-ui="EditorItemEstimateIncompleteFilter"]')
				?.getAttribute("data-selected"),
		).toBe("false");
		expect(container.querySelector('[data-ui="EditorSelectTrigger"]')?.textContent).toContain(
			"Fastest first",
		);

		const bakeryLink = container.querySelector<HTMLAnchorElement>('[data-item-id="bakery"] a');
		expect(bakeryLink?.dataset.to).toBe(
			"/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
		);
		expect(bakeryLink?.dataset.params).toContain('"sectionId":"estimate"');

		await setSort(container, "Slowest first");
		expect(state.selection).toEqual({
			incomplete: false,
			query: "",
			sort: "slowest",
		});

		await setSort(container, "Highest demand first");
		expect(state.selection).toEqual({
			incomplete: false,
			query: "",
			sort: "demand",
		});

		await setSearch(container, "well");
		expect(state.selection).toEqual({
			incomplete: false,
			query: "well",
			sort: "demand",
		});

		await toggleIncomplete(container);
		expect(state.selection).toEqual({
			incomplete: true,
			query: "well",
			sort: "demand",
		});
		expect(
			container
				.querySelector('[data-ui="EditorItemEstimateIncompleteFilter"]')
				?.getAttribute("data-selected"),
		).toBe("true");
	});

	it("shows one loading state while the full-project batch is calculated", async () => {
		state.estimateState = {
			maximumDemand: 0,
			rows: [],
			status: "loading",
		};
		const container = await renderList();

		expect(container.querySelector('[data-ui="EditorItemEstimatesLoading"]')).not.toBeNull();
		expect(container.textContent).toContain("Calculating all item estimates…");
		expect(readVisibleItemIds(container)).toEqual([]);
	});
});
